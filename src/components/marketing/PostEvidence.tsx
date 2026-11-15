"use client";
import { Heart, MessageCircle, Percent, TrendingUp, Trophy } from "lucide-react";
import { postEvidence, type RankedPost } from "@/lib/marketing/competitor-evidence";
const count = (n: number) => new Intl.NumberFormat("pt-BR",{maximumFractionDigits:1}).format(n);
const percent = (n: number) => new Intl.NumberFormat("pt-BR",{maximumFractionDigits:2}).format(n);
export function PostEvidence({post, evidence}: {post: RankedPost; evidence: ReturnType<typeof postEvidence>}) {
  const label = evidence.basis === "comments" ? "comentários" : "interações";
  const verdict = ({high:"Estudar primeiro",above:"Acima da média",typical:"Na faixa da média",below:"Abaixo da média",unknown:"Base insuficiente"})[evidence.level];
  return <section className="ci-evidence" aria-label="Dados e prioridade de estudo desta publicação">
    <div className="ci-evidence-metrics">
      <div className="ci-number ci-number-comments"><span><MessageCircle size={14}/> Comentários</span><strong>{post.comments_count === null ? "N/D" : count(post.comments_count)}</strong><small>{post.comments_count === null ? "Meta não informou" : "públicos"}</small></div>
      <div className={`ci-number ci-number-likes ${post.like_count===null ? "ci-number-missing" : ""}`}><span><Heart size={14}/> Curtidas</span><strong>{post.like_count === null ? "N/D" : count(post.like_count)}</strong><small>{post.like_count === null ? "Meta não informou" : "públicas"}</small></div>
      <div className={`ci-number ci-number-engagement ${evidence.engagement===null ? "ci-number-missing" : ""}`}><span><Percent size={14}/> Engajamento</span><strong>{evidence.engagement===null ? "N/D" : `${percent(evidence.engagement)}%`}</strong><small>{evidence.engagement===null ? post.interactions===null ? "faltam métricas" : "sem seguidores válidos" : "sobre seguidores atuais"}</small></div>
    </div>
    <div className={`ci-evidence-result ci-evidence-${evidence.level}`}>
      <div className="ci-evidence-heading"><span><TrendingUp size={14}/> {evidence.basis === "comments" ? "FORÇA EM COMENTÁRIOS" : "DESEMPENHO DO POST"}</span><strong>{verdict}</strong></div>
      {evidence.ratio !== null ? <><div className="ci-evidence-ratio"><b>{percent(evidence.ratio)}<small>×</small></b><span>a média de {label}<strong>{evidence.delta===0 ? "Sem variação" : `${evidence.delta!>0?"+":""}${count(evidence.delta!)}% ${evidence.delta!>0?"acima":"abaixo"}`}</strong></span></div><div className="ci-evidence-baseline">Média: <b>{count(evidence.baseline!)}</b> {label} · <b>{evidence.sample}</b> posts da amostra, mesmo perfil e formato</div></> : <p className="ci-evidence-insufficient">{evidence.value === null ? "Métrica pública não informada para este post." : evidence.sample < 5 ? `Precisamos de 5 posts com dados; há ${evidence.sample} neste perfil e formato.` : "A média é zero; não é possível calcular um multiplicador."}</p>}
      {evidence.rank !== null && <div className="ci-evidence-position"><Trophy size={14}/><b>{evidence.rank}º de {evidence.sample}</b><span>em {label} · mesmo perfil e formato</span></div>}
    </div>
    <p className="ci-evidence-guidance">{evidence.ratio === null ? "Ainda não há base para atribuir prioridade de estudo." : evidence.level === "high" ? `Prioridade alta: pelo menos 2× a média de ${label}. Estude o gancho e a estrutura.` : evidence.level === "above" ? `Boa referência para estudo: ${label} acima da média da amostra.` : `Compare este conteúdo com os destaques antes de modelar o estilo.`}</p>
    {post.interactions!==null && <p className="ci-evidence-total"><b>{count(post.interactions)}</b> interações públicas · curtidas + comentários</p>}
    {evidence.basis === "comments" && <p className="ci-evidence-limitation">Comparação só de comentários.{post.interactions === null ? " Engajamento total indisponível." : " Base insuficiente para comparar interações totais."}</p>}
  </section>;
}
