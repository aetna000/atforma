// Conversation belongs to the project file, without changing the design revision.
export function conversationMessages(project, fallback = []) {
  const messages = project.extensions?.conversation?.messages;
  return Array.isArray(messages) && messages.length ? cleanMessages(messages) : fallback;
}
function cleanMessages(messages) {
  return messages.filter(m => m && ['user','assistant'].includes(m.role) && typeof m.text === 'string').map(m => ({
    role:m.role, text:m.text,
    ...(Array.isArray(m.attachments) && m.attachments.length ? {attachments:m.attachments.filter(a=>a && typeof a === "object").map(a=>({id:String(a.id || a.name),name:String(a.name || 'Attachment'),mime:String(a.mime || ''),originalNotSaved:true}))} : {}),
  }));
}
export function withConversation(project, messages) {
  return {...project, extensions:{...project.extensions, conversation:{version:1,messages:cleanMessages(messages)}}};
}
