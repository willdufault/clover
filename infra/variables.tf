variable "cognito_domain_prefix" {
  type    = string
  default = "wduf-clover"
}

variable "app_origins" {
  type    = list(string)
  default = ["http://localhost:5173", "https://willdufault.dev", "https://willdufault.github.io"]
}

variable "region" {
  type    = string
  default = "us-east-1"
}
