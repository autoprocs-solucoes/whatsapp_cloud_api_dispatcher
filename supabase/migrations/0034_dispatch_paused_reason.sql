-- Por que a transmissão parou.
--
-- Uma transmissão queimou 1.905 destinatários contra um modelo que a Meta
-- tinha pausado por qualidade logo no começo do envio: nenhuma mensagem saiu,
-- e ela foi até o fim mesmo assim. Agora o worker para no primeiro erro que
-- vale pra fila inteira — e precisa dizer na tela o que houve, senão "pausada"
-- sozinho não explica nada a quem chega depois.
alter table public.dispatch
  add column if not exists paused_reason text;
