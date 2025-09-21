#!/bin/bash

# VSA Website Deployment Script
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-staging}
REGION=${2:-us-east-1}
CLUSTER_NAME="vsa-website-cluster"
SERVICE_NAME="vsa-website-service"

echo -e "${GREEN}🚀 Starting VSA Website deployment to ${ENVIRONMENT}${NC}"

# Check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}📋 Checking prerequisites...${NC}"
    
    if ! command -v aws &> /dev/null; then
        echo -e "${RED}❌ AWS CLI not found. Please install it first.${NC}"
        exit 1
    fi
    
    if ! command -v kubectl &> /dev/null; then
        echo -e "${RED}❌ kubectl not found. Please install it first.${NC}"
        exit 1
    fi
    
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker not found. Please install it first.${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ All prerequisites met${NC}"
}

# Build and push Docker image
build_and_push() {
    echo -e "${YELLOW}🐳 Building and pushing Docker image...${NC}"
    
    # Get AWS account ID
    AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"
    IMAGE_TAG="${ECR_REGISTRY}/vsa-website:${ENVIRONMENT}-$(date +%Y%m%d-%H%M%S)"
    
    # Build image
    docker build -t vsa-website .
    docker tag vsa-website:latest ${IMAGE_TAG}
    
    # Login to ECR
    aws ecr get-login-password --region ${REGION} | docker login --username AWS --password-stdin ${ECR_REGISTRY}
    
    # Push image
    docker push ${IMAGE_TAG}
    
    echo -e "${GREEN}✅ Image pushed: ${IMAGE_TAG}${NC}"
    echo "IMAGE_TAG=${IMAGE_TAG}" > .env.deploy
}

# Deploy to Kubernetes
deploy_k8s() {
    echo -e "${YELLOW}☸️  Deploying to Kubernetes...${NC}"
    
    # Update kubeconfig
    aws eks update-kubeconfig --region ${REGION} --name ${CLUSTER_NAME}
    
    # Apply namespace
    kubectl apply -f k8s/namespace.yaml
    
    # Create secrets
    kubectl create secret generic vsa-secrets \
        --from-literal=supabase-url="${REACT_APP_SUPABASE_URL}" \
        --from-literal=supabase-anon-key="${REACT_APP_SUPABASE_ANON_KEY}" \
        --namespace=vsa-website \
        --dry-run=client -o yaml | kubectl apply -f -
    
    # Update deployment with new image
    if [ -f .env.deploy ]; then
        source .env.deploy
        kubectl set image deployment/vsa-website vsa-website=${IMAGE_TAG} -n vsa-website
    fi
    
    # Apply deployment
    kubectl apply -f k8s/deployment.yaml
    
    # Wait for rollout
    kubectl rollout status deployment/vsa-website -n vsa-website --timeout=300s
    
    echo -e "${GREEN}✅ Kubernetes deployment completed${NC}"
}

# Run health checks
health_check() {
    echo -e "${YELLOW}🏥 Running health checks...${NC}"
    
    # Get service endpoint
    SERVICE_ENDPOINT=$(kubectl get service vsa-website-service -n vsa-website -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
    
    if [ -z "$SERVICE_ENDPOINT" ]; then
        echo -e "${RED}❌ Service endpoint not found${NC}"
        exit 1
    fi
    
    # Wait for service to be ready
    echo "Waiting for service to be ready..."
    sleep 30
    
    # Test health endpoint
    if curl -f "http://${SERVICE_ENDPOINT}/health"; then
        echo -e "${GREEN}✅ Health check passed${NC}"
    else
        echo -e "${RED}❌ Health check failed${NC}"
        exit 1
    fi
}

# Cleanup old images
cleanup() {
    echo -e "${YELLOW}🧹 Cleaning up old images...${NC}"
    
    # Keep only last 5 images
    aws ecr list-images --repository-name vsa-website --region ${REGION} \
        --query 'imageIds[?imageTag!=`null`]' --output json | \
        jq 'sort_by(.imagePushedAt) | reverse | .[5:] | .[].imageDigest' | \
        xargs -I {} aws ecr batch-delete-image --repository-name vsa-website --region ${REGION} --image-ids imageDigest={} || true
    
    echo -e "${GREEN}✅ Cleanup completed${NC}"
}

# Main deployment flow
main() {
    check_prerequisites
    build_and_push
    deploy_k8s
    health_check
    cleanup
    
    echo -e "${GREEN}🎉 Deployment to ${ENVIRONMENT} completed successfully!${NC}"
    echo -e "${YELLOW}📊 Monitor your deployment at: https://console.aws.amazon.com/eks/home?region=${REGION}#/clusters/${CLUSTER_NAME}${NC}"
}

# Run main function
main "$@"
