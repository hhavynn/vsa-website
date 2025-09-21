# VSA Website Infrastructure
terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    vercel = {
      source  = "vercel/vercel"
      version = "~> 1.0"
    }
  }
}

# AWS Provider
provider "aws" {
  region = var.aws_region
}

# Vercel Provider
provider "vercel" {
  api_token = var.vercel_api_token
}

# Variables
variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "vercel_api_token" {
  description = "Vercel API token"
  type        = string
  sensitive   = true
}

# S3 Bucket for static assets
resource "aws_s3_bucket" "static_assets" {
  bucket = "vsa-website-assets-${random_id.bucket_suffix.hex}"
}

resource "random_id" "bucket_suffix" {
  byte_length = 4
}

# CloudFront Distribution
resource "aws_cloudfront_distribution" "cdn" {
  origin {
    domain_name = aws_s3_bucket.static_assets.bucket_regional_domain_name
    origin_id   = "S3-${aws_s3_bucket.static_assets.bucket}"
  }

  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"

  default_cache_behavior {
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-${aws_s3_bucket.static_assets.bucket}"
    compress               = true
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

# Vercel Project
resource "vercel_project" "vsa_website" {
  name = "vsa-website"
  git {
    type = "github"
    repo = "your-username/vsa-website"
  }
}

# Environment Variables
resource "vercel_env" "supabase_url" {
  project_id = vercel_project.vsa_website.id
  key        = "REACT_APP_SUPABASE_URL"
  value      = var.supabase_url
  target     = ["production", "preview"]
}

resource "vercel_env" "supabase_anon_key" {
  project_id = vercel_project.vsa_website.id
  key        = "REACT_APP_SUPABASE_ANON_KEY"
  value      = var.supabase_anon_key
  target     = ["production", "preview"]
  sensitive  = true
}
