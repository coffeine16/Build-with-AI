terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
}

provider "aws" { region = var.aws_region }

resource "aws_vpc" "awaaz" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags = { Name = "awaaz-vpc" }
}

resource "aws_internet_gateway" "awaaz" {
  vpc_id = aws_vpc.awaaz.id
  tags   = { Name = "awaaz-igw" }
}

resource "aws_subnet" "awaaz_public" {
  vpc_id                  = aws_vpc.awaaz.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "${var.aws_region}a"
  map_public_ip_on_launch = true
  tags = { Name = "awaaz-public-subnet" }
}

resource "aws_route_table" "awaaz" {
  vpc_id = aws_vpc.awaaz.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.awaaz.id
  }
  tags = { Name = "awaaz-rt" }
}

resource "aws_route_table_association" "awaaz" {
  subnet_id      = aws_subnet.awaaz_public.id
  route_table_id = aws_route_table.awaaz.id
}

resource "aws_security_group" "awaaz" {
  name        = "awaaz-sg"
  description = "Awaaz EC2 ingress"
  vpc_id      = aws_vpc.awaaz.id

  # 22 ssh, 80/443 caddy https, 5678 n8n direct (debugging only)
  dynamic "ingress" {
    for_each = [22, 80, 443, 5678]
    content {
      from_port   = ingress.value
      to_port     = ingress.value
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
    }
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "awaaz-sg" }
}

resource "tls_private_key" "awaaz" {
  algorithm = "RSA"
  rsa_bits  = 4096
}

resource "aws_key_pair" "awaaz" {
  key_name   = "awaaz-key"
  public_key = tls_private_key.awaaz.public_key_openssh
}

resource "local_file" "ssh_key" {
  content         = tls_private_key.awaaz.private_key_pem
  filename        = "${path.module}/awaaz-key.pem"
  file_permission = "0400"
}

data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]
  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }
}

resource "aws_instance" "awaaz" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = "t3.small" # t3.micro (1GB) cannot hold n8n + pipeline + docker — learned the hard way
  subnet_id              = aws_subnet.awaaz_public.id
  vpc_security_group_ids = [aws_security_group.awaaz.id]
  key_name               = aws_key_pair.awaaz.key_name
  user_data              = file("${path.module}/user-data.sh")
  root_block_device {
    volume_size = 20
    volume_type = "gp3"
  }
  tags = { Name = "awaaz-server" }
}

resource "aws_eip" "awaaz" {
  instance = aws_instance.awaaz.id
  domain   = "vpc"
  tags     = { Name = "awaaz-eip" }
}
