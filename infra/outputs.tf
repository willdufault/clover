output "api_url" {
  value = aws_apigatewayv2_api.api.api_endpoint
}

output "cognito_url" {
  value = "https://${aws_cognito_user_pool_domain.users.domain}.auth.${var.region}.amazoncognito.com"
}

output "client_id" {
  value = aws_cognito_user_pool_client.web.id
}

output "cognito_issuer" {
  value = local.cognito_issuer
}
