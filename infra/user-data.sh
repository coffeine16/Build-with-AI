#!/bin/bash
set -e
exec > >(tee /var/log/awaaz-setup.log) 2>&1
echo "=== Awaaz EC2 bootstrap starting at $(date) ==="

apt-get update -y
apt-get install -y ca-certificates curl gnupg python3-pip

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu noble stable" \
  | tee /etc/apt/sources.list.d/docker.list

apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
usermod -aG docker ubuntu

mkdir -p /home/ubuntu/awaaz
chown ubuntu:ubuntu /home/ubuntu/awaaz
touch /home/ubuntu/awaaz/.setup-complete
chown ubuntu:ubuntu /home/ubuntu/awaaz/.setup-complete

echo "=== Awaaz EC2 bootstrap done at $(date) ==="
