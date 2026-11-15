output "api_url" {
  value = aws_apigatewayv2_api.api.api_endpoint
}

output "cognito_url" {
  value = "https://${aws_cognito_user_pool_domain.users.domain}.auth.us-east-1.amazoncognito.com"
}

output "client_id" {
  value = aws_cognito_user_pool_client.web.id
}

output "user_pool_id" {
  value = aws_cognito_user_pool.users.id
}
