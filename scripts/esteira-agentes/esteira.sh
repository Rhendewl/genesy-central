#!/bin/bash
# Esteira das IAs: os agentes (Alfred, Bruce) avisam a plataforma do que estão fazendo.
# Instalado no servidor dos agentes em /home/agentes/agentes/ferramentas/esteira.sh
#
# Uso (a partir da pasta do agente):
#   bash ../ferramentas/esteira.sh item        '<json>'   cria/atualiza um trabalho
#   bash ../ferramentas/esteira.sh evento      '<json>'   uma linha no feed
#   bash ../ferramentas/esteira.sh aprendizado '<json>'   regra salva ou proposta
#   bash ../ferramentas/esteira.sh decisoes    <agente>   decisões feitas na plataforma
#
# Lê ESTEIRA_URL e ESTEIRA_AGENT_SECRET de ../esteira.env. Nunca imprime o segredo.
# Se a plataforma estiver fora do ar, avisa e sai com 0: a esteira nunca trava o trabalho.
set -u
BASE="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$BASE/esteira.env"
[ -f "$ENV_FILE" ] || { echo "esteira: $ENV_FILE não existe (esteira desligada)"; exit 0; }
ESTEIRA_URL="$(grep -m1 '^ESTEIRA_URL=' "$ENV_FILE" | cut -d= -f2-)"
SEGREDO="$(grep -m1 '^ESTEIRA_AGENT_SECRET=' "$ENV_FILE" | cut -d= -f2-)"
[ -n "$ESTEIRA_URL" ] && [ -n "$SEGREDO" ] || { echo "esteira: esteira.env incompleto (esteira desligada)"; exit 0; }

ACAO="${1:-}"; ARG="${2:-}"
case "$ACAO" in
  item)        ROTA="itens" ;;
  evento)      ROTA="eventos" ;;
  aprendizado) ROTA="aprendizados" ;;
  decisoes)    ROTA="decisoes"; ARG="{\"agente\":\"$ARG\"}" ;;
  *) echo "uso: esteira.sh item|evento|aprendizado '<json>'  ou  esteira.sh decisoes alfred|bruce" >&2; exit 2 ;;
esac
[ -n "$ARG" ] || { echo "esteira: faltou o JSON" >&2; exit 2; }

HDR="$(mktemp)"; trap 'rm -f "$HDR"' EXIT; chmod 600 "$HDR"
printf 'Authorization: Bearer %s\nContent-Type: application/json\n' "$SEGREDO" > "$HDR"
RESP="$(curl -sS --max-time 15 -w '\n%{http_code}' -X POST -H @"$HDR" --data-binary "$ARG" "$ESTEIRA_URL/api/esteira/agente/$ROTA" 2>&1)"
CODIGO="$(printf '%s' "$RESP" | tail -n1)"; CORPO="$(printf '%s' "$RESP" | sed '$d')"
case "$CODIGO" in
  2??) printf '%s\n' "$CORPO" ;;
  400) echo "esteira: dados recusados: $CORPO" ;;
  *)   echo "esteira: plataforma indisponível agora (HTTP $CODIGO); siga o trabalho normalmente" ;;
esac
exit 0
