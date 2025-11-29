

# Configuración del proveedor AWS usando las variables definidas
provider "aws" {
  region = "us-east-2"  # Cambia según tu región preferida

    default_tags {
    tags = {
      Environment = "dev"
      Project     = local.project_name
      Terraform   = "true"
    }
  }
}
# ----------------------------------------------------
# 1. CONFIGURACIÓN INICIAL Y PROVEEDOR
# ----------------------------------------------------

# Configuración de Terraform
terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.0"
    }
    null = {
      source  = "hashicorp/null"
      version = "~> 3.0"
    }
  }
}

# Leer variables del archivo .env
locals {
  env_file_path = "${path.module}/.env"
  # Paso 1: Usamos fileexists() para verificar la existencia del archivo.
  env_content = fileexists(local.env_file_path) ? file(local.env_file_path) : ""
  
  # Paso 2: Crear el mapa de variables *sin* aplicar fallbacks (podría estar vacío)
  env_vars_raw = {
    for line in compact(split("\n", local.env_content)) :
    trimspace(split("=", line)[0]) => trimspace(element(split("=", line), 1))
    if length(split("=", line)) == 2 && !startswith(trimspace(line), "#")
  }

  # CORRECCIÓN: Paso 3: Fusionar (merge) los valores leídos con valores por defecto.
  # Los valores leídos de env_vars_raw sobrescribirán los valores por defecto si existen.
  env_vars = merge({
    AWS_REGION          = "us-east-2" # Valor por defecto si no se encuentra en .env
    AWS_ACCESS_KEY_ID   = ""          # Valor por defecto
    AWS_SECRET_ACCESS_KEY = ""        # Valor por defecto
  }, local.env_vars_raw)

  # RENOMBRADO: Usamos "statistics-module" para el proyecto.
  project_name = "statistics-module" # Nombre base para recursos S3
}

# Data source para obtener el ID de la cuenta actual (necesario para el nombre del bucket S3)
data "aws_caller_identity" "current" {}


# ----------------------------------------------------
# 2. DESPLIEGUE DE CÓDIGO A TRAVÉS DE S3
# ----------------------------------------------------

# Build step para compilar la Lambda (se mantiene)
resource "null_resource" "build_lambda" {
  triggers = {
    always_run = timestamp()
  }

  provisioner "local-exec" {
    # RUTA CRÍTICA 1 (ACTUALIZADA): Ejecuta npm install y build en la raíz del módulo de Terraform.
    working_dir = "${path.module}/" 
    command     = "npm install && npm run build"
  }
}

# Data source para el zip de Lambda (se mantiene para calcular el path y el hash)
data "archive_file" "lambda_zip" {
  type        = "zip"
  # RUTA CRÍTICA 2 (ACTUALIZADA): El código compilado se encuentra en el directorio 'dist' superior.
  source_dir  = "${path.module}/../dist" 
  output_path = "${path.module}/${local.project_name}.zip" # Usamos el nombre del proyecto
  
  depends_on = [null_resource.build_lambda]
}

# 2.1 Crear el Bucket S3 para almacenar el código de la Lambda.
resource "aws_s3_bucket" "lambda_code_bucket" {
  # Nombre único basado en el proyecto, la región y el Account ID
  bucket = "${local.project_name}-code-${lower(local.env_vars["AWS_REGION"])}-${data.aws_caller_identity.current.account_id}"
}

# 2.2 Subir el archivo ZIP a S3
resource "aws_s3_object" "lambda_zip_upload" {
  bucket = aws_s3_bucket.lambda_code_bucket.id
  # Usamos el nombre base del archivo ZIP (statistics-module.zip)
  key    = basename(data.archive_file.lambda_zip.output_path)
  # Usamos la ruta completa del ZIP generado
  source = data.archive_file.lambda_zip.output_path
  # CORRECCIÓN: Usamos el MD5 hash calculado por el data source, no filemd5(), 
  # ya que filemd5 se evalúa en la fase de plan y el archivo aún no existe.
  etag   = data.archive_file.lambda_zip.output_md5 

  depends_on = [
    aws_s3_bucket.lambda_code_bucket,
    data.archive_file.lambda_zip # Asegurar que el ZIP esté creado
  ]
}

# ----------------------------------------------------
# 3. AWS DynamoDB
# ----------------------------------------------------

# Data source para obtener el ARN de la tabla de links principal (short_links)
# Asumimos que esta tabla ya existe en tu cuenta y la Lambda necesita consultarla.
data "aws_dynamodb_table" "short_links" {
  name = "short_links" # Nombre de la tabla que la lógica de negocio busca
}

# ----------------------------------------------------
# 4. IAM ROLE Y POLICY
# ----------------------------------------------------

# IAM Role para Lambda
resource "aws_iam_role" "lambda_exec" {
  name = "${local.project_name}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

# IAM Policy para Lambda
resource "aws_iam_role_policy" "lambda_policy" {
  name = "${local.project_name}-lambda-policy"
  role = aws_iam_role.lambda_exec.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        # CORRECCIÓN: Permitir acceso solo a la tabla de links principal (short_links).
        Resource = [
          data.aws_dynamodb_table.short_links.arn
        ]
      }
    ]
  })
}

# ----------------------------------------------------
# 5. FUNCIÓN LAMBDA (USANDO S3)
# ----------------------------------------------------

# Lambda Function
resource "aws_lambda_function" "statistics_lambda" { 
  function_name = local.project_name
  role          = aws_iam_role.lambda_exec.arn
  # HANDLER: La ruta dentro del ZIP (que empieza en 'dist') hasta el archivo y función
  handler       = "infrastructure/controller/stadisticshandler.handler" 
  runtime       = "nodejs20.x"
  memory_size   = 256
  timeout       = 30

  # *** IMPLEMENTACIÓN S3 EXCLUSIVA ***
  s3_bucket        = aws_s3_bucket.lambda_code_bucket.id
  s3_key           = aws_s3_object.lambda_zip_upload.key
  # Usamos el hash SHA256 calculado localmente (Soluciona el error de "inconsistent plan")
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256

  environment {
    variables = {
      # ACTUALIZADO: Referenciar la tabla short_links como variable de entorno
      SHORT_LINKS_TABLE = data.aws_dynamodb_table.short_links.name 
      ENVIRONMENT     = "dev"
      NODE_ENV        = "production"
    }
  }

  tags = {
    Environment = "dev"
    Project     = local.project_name
  }

  depends_on = [
    aws_iam_role_policy.lambda_policy,
    aws_s3_object.lambda_zip_upload # Dependencia de la subida a S3
  ]
}

# ----------------------------------------------------
# 6. API GATEWAY (REST API)
# ----------------------------------------------------

# REST API
resource "aws_api_gateway_rest_api" "main" {
  name          = "${local.project_name}-api"
  description   = "API para consultar estadísticas de enlaces" 

  endpoint_configuration {
    types = ["REGIONAL"]
  }

  tags = {
    Environment = "dev"
    Project     = local.project_name
  }
}

# REST API Resource
resource "aws_api_gateway_resource" "status" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "status"
}

# REST API Sub-resource for {linkId}
resource "aws_api_gateway_resource" "link_id" { 
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.status.id
  path_part   = "{linkId}"                       
}

# REST API Method
resource "aws_api_gateway_method" "get_status" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.link_id.id 
  http_method   = "GET"
  authorization = "NONE"

  request_parameters = {
    "method.request.path.linkId" = true 
  }
}

# REST API Integration
resource "aws_api_gateway_integration" "lambda" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.link_id.id 
  http_method = aws_api_gateway_method.get_status.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.statistics_lambda.invoke_arn 

  request_parameters = {
    "integration.request.path.linkId" = "method.request.path.linkId" 
  }
}

# REST API Deployment
resource "aws_api_gateway_deployment" "main" {
  rest_api_id = aws_api_gateway_rest_api.main.id

  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_resource.status.id,
      aws_api_gateway_resource.link_id.id, 
      aws_api_gateway_method.get_status.id,
      aws_api_gateway_integration.lambda.id,
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [
    aws_api_gateway_integration.lambda
  ]
}

# REST API Stage
resource "aws_api_gateway_stage" "dev" {
  deployment_id = aws_api_gateway_deployment.main.id
  rest_api_id   = aws_api_gateway_rest_api.main.id
  stage_name    = "dev"

  tags = {
    Environment = "dev"
    Project     = local.project_name
  }
}

# Lambda Permission para REST API
resource "aws_lambda_permission" "api_gw" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.statistics_lambda.function_name 
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.main.execution_arn}/*/GET/status/{linkId}" 
}

# ----------------------------------------------------
# 7. LOGGING
# ----------------------------------------------------

# CloudWatch Log Group para REST API
resource "aws_cloudwatch_log_group" "api_gw" {
  name              = "API-Gateway-Execution-Logs_${aws_api_gateway_rest_api.main.id}/dev"
  retention_in_days = 7
}

# CloudWatch Log Group para Lambda
resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${local.project_name}"
  retention_in_days = 7
}

# ----------------------------------------------------
# 8. OUTPUTS
# ----------------------------------------------------

# Outputs
output "lambda_function_name" {
  description = "Name of the Lambda function"
  value       = aws_lambda_function.statistics_lambda.function_name
}

output "lambda_function_arn" {
  description = "ARN of the Lambda function"
  value       = aws_lambda_function.statistics_lambda.arn
}

output "api_gateway_url" {
  description = "URL of the REST API"
  value       = aws_api_gateway_rest_api.main.id
}

output "api_gateway_invoke_url" {
  description = "Invoke URL for the REST API stage"
  value       = "https://${aws_api_gateway_rest_api.main.id}.execute-api.${local.env_vars["AWS_REGION"]}.amazonaws.com/${aws_api_gateway_stage.dev.stage_name}"
}

output "dynamodb_table_name" {
  description = "Name of the DynamoDB table"
  value       = data.aws_dynamodb_table.short_links.name # REFERENCIA ACTUALIZADA
}

output "dynamodb_table_arn" {
  description = "ARN of the DynamoDB table"
  value       = data.aws_dynamodb_table.short_links.arn # REFERENCIA ACTUALIZADA
}

output "full_status_endpoint" {
  description = "Full endpoint URL for status checks"
  value       = "https://${aws_api_gateway_rest_api.main.id}.execute-api.${local.env_vars["AWS_REGION"]}.amazonaws.com/${aws_api_gateway_stage.dev.stage_name}/status/{linkId}"
}

output "example_curl_command" {
  description = "Example curl command to test the endpoint"
  value       = "curl -X GET 'https://${aws_api_gateway_rest_api.main.id}.execute-api.${local.env_vars["AWS_REGION"]}.amazonaws.com/${aws_api_gateway_stage.dev.stage_name}/status/link-abc'"
}