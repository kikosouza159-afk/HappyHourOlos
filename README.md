# AFTERHOURS · Votação da confraternização

Site interativo, mobile-first, feito para o time escolher **um bar** e **uma hamburgueria** para a confraternização. O segmento Bares possui sete locais, e Hamburguerias possui cinco, **scrollytelling** no desktop, galeria de fotos, localização no Google Maps, botão de voto e placar atualizado a cada 15 segundos.

## Tecnologias

- **React + Vite**, JavaScript e CSS responsivo.
- **GSAP + ScrollTrigger**: animação de entrada e narrativa de cinco etapas por segmento, controlada pela rolagem.
- **Three.js**: objeto 3D interativo na abertura, feito com geometria nativa sem depender de Blender ou Spline.
- **Node.js + Express**: API da votação e integração server-side com o Google Places (New).
- **PostgreSQL (Neon ou equivalente)**: votos persistentes mesmo após reinicializações do Render.
- `design-tokens.json`: paleta, tipografia e componentes-base para reconstrução no **Figma**. Não é um arquivo `.fig`.

## 1. Rodar no seu computador

Pré-requisito: Node.js 20.11+.

```bash
npm install
cp .env.example .env
npm run dev
```

Abra `http://localhost:5173`. O frontend usa a API em `http://localhost:4000` via proxy Vite.

Sem `DATABASE_URL`, votos são salvos em `.local-data/votes.json` **somente para testar localmente**. Esta pasta não é enviada ao GitHub. No Render, o armazenamento local pode ser apagado a qualquer reinicialização ou novo deploy.

## 2. Subir para um repositório no GitHub

Crie um repositório vazio no GitHub, abra um terminal na pasta extraída e execute:

```bash
git init
git add .
git commit -m "feat: afterhours scrollytelling e votação"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/afterhours-votacao.git
git push -u origin main
```

O `.env` e os votos locais são ignorados pelo Git.

## 3. Banco de dados persistente

Crie um banco **PostgreSQL**, por exemplo no [Neon](https://neon.tech/), e copie a connection string. Ela deve ter o formato:

```
postgresql://usuario:senha@host.neon.tech/nome_do_banco?sslmode=require
```

A aplicação cria automaticamente a tabela `afterhours_ballots` e preserva os votos antigos nas tabelas anteriores. Cada nome normalizado pode registrar dois votos por turno, em estabelecimentos diferentes. O nome é transformado em hash HMAC-SHA256, sem ser gravado em texto claro.

**Atenção:** a identificação apenas pelo nome é adequada para uma enquete informal, mas não comprova a identidade. Pessoas com nomes idênticos compartilham os mesmos dois votos; qualquer pessoa que informe o mesmo nome consegue alterar as escolhas. Votos antigos identificados por e-mail são mantidos, mas não podem ser automaticamente associados aos nomes.

## 4. Publicar no Render

1. No Render, acesse **New → Blueprint** e conecte o repositório que contém `render.yaml`. Alternativamente, crie um **Web Service** usando `npm install && npm run build` no build e `npm start` na inicialização.
2. Configure as variáveis de ambiente no painel do serviço:
   - `DATABASE_URL`: **obrigatória para votos persistentes**.
   - `VOTE_SECRET`: segredo aleatório longo para gerar hash estável dos e-mails. O blueprint gera um automaticamente.
   - `GOOGLE_MAPS_API_KEY`: opcional, veja abaixo.
3. Confirme o deploy e abra a URL `https://afterhours-votacao.onrender.com` (ou a URL efetiva fornecida pelo Render).
4. Compartilhe esta URL no WhatsApp do time. Cada participante escolhe um bar e uma hamburgueria.

O blueprint utiliza o plano `free` para o serviço web (quando disponível na conta) e **não cria um banco pago**. O PostgreSQL é configurado separadamente. Consulte limites e preços atuais do Render, do Neon e do Google Maps Platform antes de ativar serviços.

## 5. Fotografias reais do Google

O site usa a integração **oficial Places API (New)**, sem extrair imagens ilegalmente dos resultados do Google. Para ativar:

1. No Google Cloud, crie um projeto, ative faturamento e a **Places API (New)**.
2. Crie uma chave de API com permissão apenas para as APIs necessárias.
3. Configure `GOOGLE_MAPS_API_KEY` como **variável secreta no Render**, jamais no `src/` nem em variável `VITE_*`.
4. O backend procura cada estabelecimento pelo nome + endereço, retorna suas primeiras três fotos com atribuições e usa a API de Photo Media para apresentá-las.
5. Quando a chave não existe, o layout mantém fotos fornecidas pelo site do local (quando disponíveis) e imagens **ilustrativas**. Elas não são apresentadas como fotos reais daquele estabelecimento.

**Google Places é um serviço sujeito a cobrança.** Recomenda-se ativar cotas e alertas de custo no Google Cloud. Fotos e locais são solicitados conforme o visitante explora; um cache temporário de metadados no processo reduz solicitações repetidas. O cartão do local inclui atribuição aos fotógrafos quando exigida. Os mapas são incorporados pelo Google Maps e têm link de abertura direta.

## 6. Personalizar locais

Edite `data/venues.json`. Os campos são: `id`, `category` (`bars` ou `burgers`), `name`, `neighborhood`, `address`, `type`, `tagline`, `description`, `details` (3 tags), `accent` (cor), `enabled` (false impede votos), `notice`, `website`, `images`, `imageSource`.

**Alerta:** o estabelecimento **A Casa do Ferreiro** aparece como *permanentemente fechado* em cadastros públicos, por isso foi mantido na lista original apenas para referência e marcado `enabled: false`. Confirme diretamente antes de reativá-lo. Também recomendamos confirmar a unidade/endereço do **Gigante Burger & BBQ**, pois fontes públicas divergem.

Se for substituir um lugar, altere o objeto correspondente, mantendo o `id` se desejar conservar os votos anteriores associados à posição. Para começar uma votação inteiramente nova, **use um ID novo** e, se necessário, crie uma nova tabela/campanha. IDs de lugares são chaves usadas pelo backend.

## 7. Rotas da API

| Rota | Método | Ação |
| --- | --- | --- |
| `/api/health` | GET | Status do serviço |
| `/api/config` | GET | Modo de persistência e configuração pública |
| `/api/results` | GET | Totais e placar por segmento |
| `/api/votes` | POST | Registrar/atualizar voto por e-mail/categoria |
| `/api/places/:id` | GET | Metadados e atribuições do Google Places |
| `/api/places/:id/photos/:index` | GET | Redirecionamento controlado à mídia do Google |


```bash
curl -X POST http://localhost:4000/api/votes \
  -H "Content-Type: application/json" \
  -d '{"name":"Maria Silva","slot":1,"category":"bars","venueId":"bar-curtica"}'
```

## Limitações e considerações

- O placar é atualizado por **polling a cada 15 segundos** (não usa WebSockets).
- A proteção contra abuso é básica (rate limit por IP em memória, um registro por hash/e-mail/categoria). Não é um sistema eleitoral auditável.
- Sem `DATABASE_URL`, o site funciona em modo demonstração, com aviso explícito de que os votos podem desaparecer no Render.
- O Google Maps iframe depende de acesso à internet e das políticas do Google; o link **Traçar rota** funciona como alternativa.
- Fotografias e preços/rodízios podem mudar com o tempo. Confirme o funcionamento de cada casa antes de fazer a reserva.
- O arquivo `design-tokens.json` facilita o trabalho no Figma; o projeto não inclui um arquivo nativo Figma, nem arquivos Blender/Spline. O 3D é renderizado diretamente com Three.js.

Feito para a confraternização do time. ✨

## V2 · Scrollytelling 3D e votação em dois turnos

**Interface:** agora cada destino aparece em um pôster 3D central, com profundidade, reflexo, card flutuante, partículas/órbitas em Three.js e transições pela rolagem com GSAP ScrollTrigger. No desktop, um único ambiente ocupa o centro da tela por etapa da rolagem, com navegação por mini-etapas e setas. No celular, a revelação dos cards é guiada pela rolagem e considera acessibilidade (`prefers-reduced-motion`). Os dois universos (bares e hamburguerias) têm progressos de voto separados.

**Votos obrigatórios:** a pessoa escolhe **um bar E uma hamburgueria por turno**. A interface mostra `0/2`, `1/2` ou `2/2`. Cada e-mail pode trocar seu voto na mesma categoria; o segundo turno exige que o mesmo e-mail tenha completado os **dois votos do primeiro turno**. Não há validação de posse do e-mail: é uma enquete informal, não uma eleição auditável.

**Passagem para o segundo turno:** a abertura é manual e restrita ao organizador, para que o grupo tenha tempo de votar. Quando aberta, a grande final reúne os **dois estabelecimentos mais votados por segmento** (apenas locais habilitados, empate resolvido por ordem alfabética), e os votos são armazenados em `public.afterhours_final_votes`. Os votos do primeiro turno continuam em `public.afterhours_votes`; o andamento da votação fica em `public.afterhours_election_state`. As duas novas tabelas são criadas automaticamente na inicialização, mas a migração equivalente está versionada em `db/migrations/001_second_round.sql`.

**Para habilitar o organizador no Render:** adicione em **Environment** uma variável `VOTE_ADMIN_KEY` contendo uma senha longa e única, salve e faça deploy. Não compartilhe esse segredo no GitHub ou no WhatsApp. Na parte final do site, abra **Área da organização**, cole a senha e clique em **Validar acesso**. Quando o primeiro turno tiver votos nas duas categorias, clique em **Abrir segundo turno** (irreversível). Depois da final, clique em **Encerrar votação**. O segundo turno começa com 0 votos nas duas categorias, sem afetar a primeira apuração.

**Rotas novas:** `GET /api/admin/status`, `POST /api/admin/advance`, `POST /api/admin/close`, todas exigindo cabeçalho `x-admin-key: SEU_SEGREDO`. `/api/results` expõe `round`, `phase`, `finalists` e `firstRound` quando aplicável. A interface faz polling a cada 15 segundos. Os votos continuam anônimos no banco (hash HMAC do e-mail), com dois registros distintos por rodada quando os dois segmentos são completados.

**Deploy:** o `render.yaml` já executa `npm install --include=dev --no-audit --no-fund && npm run build` para garantir que o Vite seja instalado, mesmo com `NODE_ENV=production`. Alterar o código no GitHub com Render conectado normalmente inicia o próximo deploy, ou use `Manual Deploy → Deploy latest commit`.

**Validação:** `npm test` inclui seleção de finalistas, exclusão de locais indisponíveis e regras da final. Abertura do turno deve ser testada com votos de teste em um banco não produtivo antes da operação real. **Não execute reset/drop nas tabelas de produção.**

## 8. Experiência imersiva em popup (V4)

A página principal agora mostra **Escolha a sua experiência** com os dois segmentos. Clique em **Bares** ou **Hamburguerias** para abrir um **portal em tela cheia**. A rolagem fica contida no popup, com um palco fixo e os estabelecimentos assumindo o centro à medida que a pessoa percorre os locais. O GSAP/ScrollTrigger acompanha o progresso de uma rolagem interna, com o CSS `position: sticky` mantendo o palco no lugar. O site por trás é bloqueado durante a exploração.

- Navegação por roda do mouse, toque no celular, setas do teclado e botões de avançar/voltar.
- Cartões centrais 3D, mudanças de ambiente, fotos do Google Places quando habilitadas, galeria/mapa sob demanda e botão de voto integrado.
- Botão **Ir para** alterna entre bares e hamburguerias sem voltar ao início. O voto continua sendo confirmado pelo mesmo formulário existente.
- A lógica e as tabelas de votação em dois turnos permanecem intactas. A grande final exibe apenas os dois finalistas de cada segmento.
- `Esc` fecha primeiro a galeria/mapa, ou fecha a experiência principal; movimentos reduzidos seguem a preferência de acessibilidade do sistema.

A instalação de dependências npm pode ser bloqueada em ambientes sem acesso à rede. Os testes de regras do projeto (`npm test`) e a verificação da compilação JSX devem ser executados antes de publicar; o build Vite completo ocorre no Render.
