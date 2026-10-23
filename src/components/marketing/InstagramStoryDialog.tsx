"use client";

import { useEffect, useRef, useState } from "react";
import { Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

type Account = { id: string; username: string; needsReconnect: boolean };
const ENDPOINT = "/api/marketing/instagram/stories";
const PENDING = "genesy-pending-instagram-story";
async function responseJson(response: Response) {
  const json = await response.json();
  if (!response.ok) throw new Error(json.error || "Não foi possível acessar o Instagram.");
  return json;
}

export async function storyJpeg(png: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(png);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1080; canvas.height = 1920;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Não foi possível preparar a imagem.");
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, 1080, 1920);
    ctx.drawImage(bitmap, 0, 0, 1080, 1920);
    for (const quality of [0.95, 0.85, 0.75]) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size <= 3 * 1024 * 1024) return blob;
    }
    throw new Error("A imagem ficou muito grande para publicar. Reduza os detalhes e tente novamente.");
  } finally { bitmap.close(); }
}

export function InstagramStoryDialog({ image, slideNumber, onClose }: { image: Blob; slideNumber: number; onClose: () => void }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState("");
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ticket, setTicket] = useState("");
  const lock = useRef(false);
  const account = accounts.find((item) => item.id === accountId);
  useEffect(() => {
    const url = URL.createObjectURL(image); setPreview(url);
    try { setTicket(sessionStorage.getItem(PENDING) || ""); } catch { /* Storage may be unavailable. */ }
    let live = true;
    fetch(ENDPOINT).then(responseJson).then((data) => {
      if (!live) return;
      setAccounts(data.accounts); setAccountId(data.accounts[0]?.id ?? "");
    }).catch((e) => { if (live) setError(e.message); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; URL.revokeObjectURL(url); };
  }, [image]);

  async function publish() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    let currentTicket = ticket;
    try {
      if (!currentTicket) {
        const form = new FormData(); form.set("connectionId", accountId); form.set("image", image, "story.jpg");
        const prepared = await responseJson(await fetch(ENDPOINT, { method: "POST", body: form }));
        currentTicket = prepared.ticket; setTicket(currentTicket);
        try { sessionStorage.setItem(PENDING, currentTicket); } catch { /* Keep in component state. */ }
      }
      for (let attempt = 0; attempt < 20; attempt++) {
        const result = await responseJson(await fetch(ENDPOINT, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticket: currentTicket }),
        }));
        if (result.published) {
          try { sessionStorage.removeItem(PENDING); } catch { /* No storage available. */ }
          toast.success("Story publicado no Instagram."); onClose(); return;
        }
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
      throw new Error("O Instagram ainda está processando. Clique em verificar publicação para continuar sem duplicar o story.");
    } catch (e) { setError(e instanceof Error ? e.message : "Falha na publicação. Confira o Instagram antes de tentar novamente."); }
    finally { lock.current = false; setBusy(false); }
  }

  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
    <DialogContent showCloseButton={false} className="z-[100] max-h-[90dvh] sm:max-w-lg p-6" overlayClassName="z-[99]">
      <div className="flex items-center justify-between gap-4"><DialogTitle className="text-lg font-semibold">Postar story</DialogTitle><button aria-label="Fechar" disabled={busy} onClick={onClose}><X size={20} /></button></div>
      {ticket ? <p className="my-4 text-sm">Há uma publicação pendente. Vamos verificar e concluir o envio anterior antes de publicar outro slide.</p> : <>
        <p className="my-3 text-sm text-[var(--muted-foreground)]">Slide {slideNumber} selecionado. Confira a imagem e a conta antes de publicar.</p>
        {preview && <img src={preview} alt={`Prévia do story, slide ${slideNumber}`} className="mx-auto max-h-[40dvh] rounded-xl object-contain" />}
        <label className="mt-4 block text-sm">Conta do Instagram<select aria-label="Conta do Instagram" disabled={busy || loading} value={accountId} onChange={(event) => setAccountId(event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] p-3">
          {!accounts.length && <option value="">{loading ? "Carregando contas…" : "Nenhuma conta conectada"}</option>}
          {accounts.map((item) => <option key={item.id} value={item.id}>@{item.username}</option>)}
        </select></label>
        {!loading && (!accounts.length || account?.needsReconnect) && <p className="mt-3 text-sm">Conecte ou reconecte sua conta em <a className="underline" href="/api/marketing/instagram/auth">Autorizar Instagram</a> para permitir a publicação de stories. Salve seu projeto antes de sair.</p>}
      </>}
      {error && <p role="alert" className="mt-4 text-sm text-red-500">{error}</p>}
      <div className="mt-5 flex flex-wrap justify-end gap-3">
        {ticket && !busy && <Button variant="outline" onClick={() => { try { sessionStorage.removeItem(PENDING); } catch {} setTicket(""); setError(""); }}>Já conferi no Instagram · encerrar pendência</Button>}
        <Button icon={<Send />} loading={busy} disabled={loading || (!ticket && (!account || account.needsReconnect))} onClick={() => void publish()}>{ticket ? "Verificar publicação" : "Publicar agora"}</Button>
      </div>
    </DialogContent>
  </Dialog>;
}
