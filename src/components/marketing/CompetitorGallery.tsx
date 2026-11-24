"use client";
import Image from "next/image";
import { useSegmentIndicator } from "@/components/ui/useSegmentIndicator";
import { PostEvidence } from "./PostEvidence";
import { postEvidence } from "@/lib/marketing/competitor-evidence";
import { useMemo, useState } from "react";
import { ArrowUpRight, BarChart3, Check, Copy, ImageIcon, Layers, Play, Search, TrendingUp, Trophy, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { instagramEmbed, safeInstagramLink, safeMediaPreview, type rankPosts } from "@/lib/marketing/competitor-domain";

type Post = ReturnType<typeof rankPosts>[number];
type Profile = { id: string; username: string; active: boolean; followers_count?: number | null };
const number = (n: number | null | undefined) => n == null ? "—" : new Intl.NumberFormat("pt-BR", {maximumFractionDigits: 1}).format(n);
const published = (value: string) => new Date(value).toLocaleDateString("pt-BR", {day: "2-digit", month: "short", year: "numeric"});
const format = (value: string) => ({VIDEO: "Vídeo", IMAGE: "Imagem", CAROUSEL_ALBUM: "Carrossel"}[value] ?? "Outro formato");
const Icon = ({type}: {type: string}) => type === "VIDEO" ? <Play size={13}/> : type === "CAROUSEL_ALBUM" ? <Layers size={13}/> : <ImageIcon size={13}/>;
const hook = (caption: string | null) => caption?.trim().split(/\n/).find(line => line.trim())?.slice(0, 180) || "Publicação sem legenda disponível";
function Preview({post, large = false}: {post: Post; large?: boolean}) {
  const [failed, setFailed] = useState(false);
  const url = safeMediaPreview(post.preview_url);
  const fallbackEmbed = !large && (!url || failed) ? instagramEmbed(post.permalink) : null;
  return <div className={`ci-preview ${large ? "ci-preview-large" : ""}`}>
    {url && !failed ? <Image unoptimized fill sizes="(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 33vw" src={url} alt={`Prévia da publicação: ${hook(post.caption)}`} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)}/> :
      <div className="ci-preview-fallback"><div className="ci-preview-grid"/><Icon type={post.media_type}/><span>GANCHO DA LEGENDA</span><p>{hook(post.caption)}</p><small>{failed ? "Prévia expirada · abra no Instagram" : "Imagem não disponível nesta coleta"}</small></div>}
    {fallbackEmbed && <iframe className="ci-card-embed" src={fallbackEmbed} title={`Prévia oficial de ${hook(post.caption)}`} loading="lazy" allow="encrypted-media; fullscreen" referrerPolicy="no-referrer"/>}
    {!fallbackEmbed && <div className="ci-preview-shade"/>}
    <span className="ci-format"><Icon type={post.media_type}/>{format(post.media_type)}</span>
  </div>;
}
export function CompetitorGallery({posts, profiles, truncated, compact=false}: {posts: Post[]; profiles: Profile[]; truncated: boolean; compact?:boolean}) {
  const [query, setQuery] = useState("");
  const [media, setMedia] = useState("all");
  const mediaSeg = useSegmentIndicator({ background: "#72d6e415", border: "1px solid #72d6e430" }, { activeSelector: '[aria-pressed="true"]' });
  const [sort, setSort] = useState("auto");
  const [onlyAbove, setOnlyAbove] = useState(false);
  const [selected, setSelected] = useState<Post | null>(null);
  const [embed, setEmbed] = useState(false);
  const [limit, setLimit] = useState(12);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const username = (post: Post) => profiles.find(p => p.id === post.profile_id)?.username ?? "perfil";
  const evidence = useMemo(() => new Map(posts.map(post => [post.profile_id+":"+post.id, postEvidence(post, posts, profiles.find(p=>p.id===post.profile_id)?.followers_count)])), [posts, profiles]);
  const details = (post: Post) => evidence.get(post.profile_id+":"+post.id)!;
  const comparable = posts.filter(p => p.score !== null);
  const best = [...comparable].sort((a,b) => b.score! - a.score!)[0];
  const mostCommented = [...posts].filter(p => p.comments_count !== null && p.comments_count > 0).sort((a,b) => b.comments_count! - a.comments_count!)[0];
  const effectiveSort = sort === "auto" ? (comparable.length ? "relative" : "comment-relative") : sort;
  const ordered = useMemo(() => posts.filter(p =>
    (media === "all" || p.media_type === media) && (!onlyAbove || (evidence.get(p.profile_id+":"+p.id)?.ratio ?? 0) > 1) &&
    `${p.caption ?? ""} ${profiles.find(x => x.id === p.profile_id)?.username ?? ""}`.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR")))
    .sort((a,b) => effectiveSort === "comment-relative" ? (evidence.get(b.profile_id+":"+b.id)?.commentRatio ?? -1) - (evidence.get(a.profile_id+":"+a.id)?.commentRatio ?? -1) || (b.comments_count ?? -1)-(a.comments_count ?? -1) : effectiveSort === "recent" ? Date.parse(b.published_at)-Date.parse(a.published_at) : effectiveSort === "comments" ? (b.comments_count ?? -1)-(a.comments_count ?? -1) : effectiveSort === "interactions" ? (b.interactions ?? -1)-(a.interactions ?? -1) : (b.score ?? -1)-(a.score ?? -1) || (b.interactions ?? -1)-(a.interactions ?? -1)), [posts, media, onlyAbove, profiles, query, effectiveSort, evidence]);
  function inspect(post: Post) { setSelected(post); setEmbed(!safeMediaPreview(post.preview_url)); setCopied(false); setCopyError(false); }
  const reset = () => {setMedia("all");setQuery("");setOnlyAbove(false);setLimit(12);};
  const noMetrics = posts.filter(p => p.interactions === null).length;
  return <div className={`ci-gallery ${compact?"ci-gallery-compact":""}`}>
    <section className="ci-overview" aria-label="Resumo do desempenho">
      <div className="ci-overview-copy"><span className="ci-eyebrow"><span/> RADAR DE CONTEÚDO</span><h2>Encontre o que merece<br/><em>virar referência.</em></h2><p>Veja quais conteúdos superaram o desempenho habitual de cada perfil. Estude o formato, o gancho e a legenda antes de criar sua versão.</p><div className="ci-source"><Check size={12}/> Dados públicos da Meta · sem estimativas privadas</div></div>
      <div className="ci-spotlight">
        <div className="ci-spotlight-label"><Trophy size={16}/> {best ? "MAIOR DESTAQUE DA AMOSTRA" : mostCommented ? "MAIS COMENTÁRIOS NA AMOSTRA" : "DESTAQUES DA AMOSTRA"}</div>
        {best ? <><span className="ci-spotlight-score">{number(best.score)}<small>×</small></span><strong>a média deste perfil e formato</strong><p>@{username(best)} · {format(best.media_type)}<br/>{number(best.interactions)} interações públicas</p><button onClick={() => inspect(best)}>Estudar este conteúdo <ArrowUpRight size={15}/></button></> : mostCommented ? <><span className="ci-spotlight-score">{number(mostCommented.comments_count)}</span><strong>comentários públicos</strong><p>@{username(mostCommented)} · {format(mostCommented.media_type)}<br/>Destaque em comentários; comparação relativa indisponível.</p><button onClick={() => inspect(mostCommented)}>Estudar este conteúdo <ArrowUpRight size={15}/></button></> : <><span className="ci-spotlight-empty"><BarChart3 size={32}/></span><strong>Aguardando base de comparação</strong><p>São necessários 5 posts com curtidas e comentários disponíveis por perfil e formato.</p></>}
      </div>
    </section>
    <div className="ci-stats">
      {[{label:"Publicações na amostra",value:posts.length,detail:"No período e perfil selecionados",icon:Layers}, {label:"Acima da média",value:posts.filter(p=>(evidence.get(p.profile_id+":"+p.id)?.ratio ?? 0)>1).length,detail:"Interações ou comentários, conforme dados",icon:TrendingUp}, {label:"Perfis monitorados",value:profiles.filter(p=>p.active).length,detail:"Conexão oficial com o Instagram",icon:Search}, {label:"Com métricas completas",value:posts.length-noMetrics,detail:noMetrics ? `${noMetrics} com dados indisponíveis` : "Curtidas + comentários públicos",icon:BarChart3}].map(item=><div className="ci-stat" key={item.label}><div><span>{item.label}</span><item.icon size={16}/></div><strong>{number(item.value)}</strong><small>{item.detail}</small></div>)}
    </div>
    <div className="ci-section-heading"><div><span className="ci-eyebrow">BIBLIOTECA DE REFERÊNCIAS</span><h2>Conteúdos em evidência</h2></div><span>{ordered.length} publicações</span></div>
    <div className="ci-tools">
      <label className="ci-search"><Search size={16}/><input aria-label="Buscar conteúdo ou perfil" placeholder="Buscar assunto, gancho ou @perfil" value={query} onChange={e=>{setQuery(e.target.value);setLimit(12);}}/>{query && <button aria-label="Limpar busca" onClick={()=>setQuery("")}><X size={13}/></button>}</label>
      <label className="ci-sort">Ordenar por<select aria-label="Ordenar publicações" value={sort} onChange={e=>{setSort(e.target.value);setLimit(12);}}><option value="auto">{comparable.length ? "Destaques relativos" : "Comentários vs. média"}</option><option value="relative">Desempenho relativo</option><option value="interactions">Mais interações</option><option value="comments">Mais comentários</option><option value="comment-relative">Comentários vs. média do perfil</option><option value="recent">Mais recentes</option></select></label>
    </div>
    <div className="ci-filter-row"><div ref={mediaSeg.trackRef} className="ci-format-tabs" aria-label="Filtrar por formato">{mediaSeg.indicator}{[["all","Todos"],["VIDEO","Vídeos"],["CAROUSEL_ALBUM","Carrosséis"],["IMAGE","Imagens"]].map(([key,label])=><button key={key} aria-pressed={media===key} onClick={()=>{setMedia(key);setLimit(12);}}>{label}</button>)}</div><button className="ci-above-filter" aria-pressed={onlyAbove} onClick={()=>{setOnlyAbove(!onlyAbove);setLimit(12);}}><TrendingUp size={14}/> Só acima da média</button></div>
    {noMetrics > 0 && <div className="ci-notice"><BarChart3 size={16}/><p><strong>{noMetrics} publicações com métricas incompletas.</strong> A Meta não disponibilizou todas as curtidas ou comentários. A comparação por interações totais fica indisponível; mostramos a força em comentários quando há base suficiente.</p></div>}
    <details className="ci-method"><summary>Como interpretar números, engajamento e prioridade?</summary><p><strong>Engajamento público</strong> = (curtidas + comentários) ÷ seguidores atuais do perfil × 100. É uma relação com a base atual de seguidores, não uma taxa por alcance. Se faltarem curtidas, comentários ou seguidores válidos, mostramos N/D. Com curtidas indisponíveis, comparamos apenas comentários do mesmo perfil e formato, com pelo menos 5 posts e média positiva.</p><p><strong>Prioridade de estudo:</strong> a partir de 2× a média, estudar primeiro; acima de 1×, acima da média; entre 0,8× e 1×, na faixa da média; abaixo de 0,8×, abaixo da média. A posição usa a contagem de interações ou comentários, conforme indicado, e empates compartilham posição. É um sinal observado na amostra, não uma previsão de potencial viral, leads ou vendas.</p><p><strong>2× a média</strong> significa o dobro de curtidas + comentários em relação à média dos posts do mesmo perfil e formato neste período. O cálculo inclui o próprio post e exige pelo menos 5 publicações completas. Isso indica destaque em interações públicas; não mede vendas, alcance, visualizações, salvamentos ou compartilhamentos. Idade do post e mídia paga podem influenciar o resultado.</p><p>Coletamos até 50 posts recentes por perfil a cada 24 horas. O histórico cresce com o monitoramento. {truncated && "A tela contém apenas as 1.000 publicações mais recentes do período."}</p></details>
    {ordered.length ? <div className="ci-post-grid">{ordered.slice(0,limit).map((post,index)=><article className={`ci-post ${post.score !== null && post.score > 1 ? "ci-post-above" : ""}`} key={post.profile_id+post.id}>
      <div className="ci-post-visual"><Preview post={post}/>{post.score !== null && effectiveSort === "relative" && <span className={`ci-rank ${index<3 ? "ci-rank-top" : ""}`}>#{index+1}</span>}<button className="ci-study-overlay" aria-label={`Estudar publicação de @${username(post)}: ${hook(post.caption)}`} onClick={()=>inspect(post)}>Estudar conteúdo <ArrowUpRight size={16}/></button></div>
      <div className="ci-post-body"><div className="ci-post-author"><strong>@{username(post)}</strong><time dateTime={post.published_at}>{published(post.published_at)}</time></div><h3>{hook(post.caption)}</h3><PostEvidence post={post} evidence={details(post)}/><button className="ci-detail-button" onClick={()=>inspect(post)}>Ver dados e legenda <ArrowUpRight size={14}/></button></div>
    </article>)}</div> : <div className="ci-empty"><Search size={28}/><h3>{posts.length ? "Nenhum conteúdo com estes filtros" : "Seu radar está pronto para a primeira coleta"}</h3><p>{posts.length ? "Altere o formato, a busca ou o filtro de desempenho para explorar a biblioteca." : "Abra Comparação e perfis e use Coletar agora para trazer as publicações públicas."}</p>{posts.length>0 && <button onClick={reset}>Limpar filtros</button>}</div>}
    {ordered.length>limit && <button className="ci-load-more" onClick={()=>setLimit(n=>n+12)}>Mostrar mais conteúdos <span>{Math.min(12,ordered.length-limit)} de {ordered.length-limit} restantes</span></button>}
    <Dialog open={selected!==null} onOpenChange={open=>{if(!open)setSelected(null);}}>
      <DialogContent className="ci-dialog sm:!max-w-[960px] !p-0" showCloseButton={false}>
        {selected && <><div className="ci-dialog-header"><div><DialogTitle>Estudar conteúdo</DialogTitle><DialogDescription>@{username(selected)} · {format(selected.media_type)} · {published(selected.published_at)}</DialogDescription></div><button aria-label="Fechar estudo do conteúdo" onClick={()=>setSelected(null)}><X size={18}/></button></div><div className="ci-dialog-columns"><div className="ci-dialog-media">{embed && instagramEmbed(selected.permalink) ? <iframe title="Publicação original no Instagram" src={instagramEmbed(selected.permalink)!} loading="lazy" allow="encrypted-media; fullscreen" referrerPolicy="no-referrer"/> : <><Preview key={selected.id} post={selected} large/>{instagramEmbed(selected.permalink)&&<button className="ci-embed-button" onClick={()=>setEmbed(true)}><Play size={14}/> Carregar publicação do Instagram</button>}</>}</div><div className="ci-dialog-data"><PostEvidence post={selected} evidence={details(selected)}/><div className="ci-hook"><span>GANCHO · PRIMEIRA LINHA DA LEGENDA</span><p>{hook(selected.caption)}</p></div><div className="ci-caption-heading"><h3>Legenda completa</h3><button disabled={!selected.caption} onClick={async()=>{try{await navigator.clipboard.writeText(selected.caption!);setCopied(true);setCopyError(false);}catch{setCopyError(true);}}}>{copied?<Check size={13}/>:<Copy size={13}/>} {copied?"Copiada":"Copiar"}</button></div>{copyError&&<p role="alert">Não foi possível copiar. Selecione o texto abaixo.</p>}<p className="ci-full-caption">{selected.caption || "Legenda não disponibilizada pela Meta."}</p><div className="ci-model-note"><strong>O que observar para modelar</strong><p>Compare a abertura, a estrutura da legenda, o formato e a chamada para ação. Use como referência para criar conteúdo próprio. Esta tela não analisa o vídeo automaticamente.</p></div><p className="ci-collected">Métricas coletadas em {new Date(selected.collected_at).toLocaleString("pt-BR")}. “—” significa indisponível.</p>{safeInstagramLink(selected.permalink)&&<a className="ci-original" href={safeInstagramLink(selected.permalink)!} target="_blank" rel="noopener noreferrer">Abrir publicação original <ArrowUpRight size={16}/></a>}</div></div></>}
      </DialogContent>
    </Dialog>
  </div>;
}
