#!/bin/bash
# Entrega aos agentes as decisões feitas na plataforma (Aprovar / Ajustar / propostas).
# Roda a cada minuto pelo cron do usuário "agentes". Busca as decisões de cada agente
# e, se houver, escreve uma mensagem na sessão tmux dele, como se fosse um aviso do Lancaster.
set -u
BASE="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin"
for AGENTE in alfred bruce; do
  tmux has-session -t "$AGENTE" 2>/dev/null || continue
  JSON="$(bash "$BASE/ferramentas/esteira.sh" decisoes "$AGENTE")"
  MSG="$(printf '%s' "$JSON" | python3 -c '
import json, sys
try:
    d = json.load(sys.stdin)
except Exception:
    sys.exit(0)
linhas = []
for i in d.get("itens") or []:
    alvo = "“%s”%s (ref %s)" % (i.get("titulo"), (" · " + i["cliente"]) if i.get("cliente") else "", i.get("ref"))
    if i.get("decisao") == "aprovado":
        linhas.append("APROVADO: " + alvo)
    else:
        linhas.append("AJUSTE em " + alvo + ": " + (i.get("decisao_nota") or ""))
for a in d.get("aprendizados") or []:
    linhas.append(("PROPOSTA ACEITA (grave a regra): " if a.get("status") == "aceita" else "PROPOSTA DESCARTADA (não grave): ") + (a.get("texto") or "") + " (ref %s)" % a.get("ref"))
if linhas:
    texto = "[Esteira] Decisões do Lancaster feitas na plataforma. Valem como a resposta dele no Telegram: " + " | ".join(linhas) + " — Confirme no Telegram em uma linha e siga o fluxo normal de cada item, atualizando a esteira."
    print(" ".join(texto.split())[:3000])
')"
  [ -n "$MSG" ] || continue
  tmux send-keys -t "$AGENTE" -l "$MSG"
  sleep 1
  tmux send-keys -t "$AGENTE" Enter
done
