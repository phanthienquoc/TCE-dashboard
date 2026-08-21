#!/usr/bin/env bash
set -euo pipefail

# TCE single-node k3s bootstrap. Existing Docker/Nginx workloads are not touched.
# Run on the VPS as ubuntu with sudo access.

NODE_NAME="tce-k3s-01"
NAMESPACE="tce"

if ! command -v k3s >/dev/null 2>&1; then
  curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="server --node-name ${NODE_NAME} --disable traefik" sh -
fi

sudo systemctl enable --now k3s
sudo kubectl create namespace "${NAMESPACE}" --dry-run=client -o yaml | sudo kubectl apply -f -

# Keep TCE isolated from existing Docker workloads.
sudo kubectl label namespace "${NAMESPACE}" app.kubernetes.io/part-of=tce --overwrite

sudo kubectl get nodes -o wide
sudo kubectl get pods -A
sudo kubectl get namespace "${NAMESPACE}"

echo "TCE k3s bootstrap complete. Existing Nginx and Docker services were not modified."
