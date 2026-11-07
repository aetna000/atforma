import React from 'react';
// Small, non-HTML Markdown renderer: no remote images, raw HTML or executable URLs.
function inline(text){return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g).map((part,i)=>{
 if(part.startsWith('**')&&part.endsWith('**'))return <strong key={i}>{part.slice(2,-2)}</strong>;
 if(part.startsWith('`')&&part.endsWith('`'))return <code key={i}>{part.slice(1,-1)}</code>;
 const link=part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);if(link)return <a key={i} href={link[2]} target="_blank" rel="noopener noreferrer">{link[1]}</a>;
 return part;
});}
export function ChatMessage({text=''}){
 const lines=text.split('\n'),blocks=[];let i=0;
 while(i<lines.length){
  if(!lines[i].trim()){i++;continue;}
  if(lines[i].startsWith('```')){const code=[];i++;while(i<lines.length&&!lines[i].startsWith('```'))code.push(lines[i++]);i++;blocks.push(<pre key={blocks.length}><code>{code.join('\n')}</code></pre>);continue;}
  const heading=lines[i].match(/^#{1,6}\s+(.+)$/);if(heading){blocks.push(<h4 key={blocks.length}>{inline(heading[1])}</h4>);i++;continue;}
  const list=lines[i].match(/^(?:[-*]|\d+[.)])\s+/);if(list){const ordered=/^\d/.test(list[0]),items=[];while(i<lines.length&&/^(?:[-*]|\d+[.)])\s+/.test(lines[i]))items.push(<li key={items.length}>{inline(lines[i++].replace(/^(?:[-*]|\d+[.)])\s+/,''))}</li>);blocks.push(ordered?<ol key={blocks.length}>{items}</ol>:<ul key={blocks.length}>{items}</ul>);continue;}
  const paragraph=[];while(i<lines.length&&lines[i].trim()&&!/^(?:```|#{1,6}\s|[-*]\s|\d+[.)]\s)/.test(lines[i]))paragraph.push(lines[i++]);blocks.push(<p key={blocks.length}>{paragraph.map((line,j)=><React.Fragment key={j}>{j>0&&<br/>}{inline(line)}</React.Fragment>)}</p>);
 }
 return <div className="chat-markdown">{blocks}</div>;
}
