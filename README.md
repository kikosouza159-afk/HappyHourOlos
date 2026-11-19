# AFTERHOURS · Votação da confraternização

Site interativo, mobile-first, feito para o time escolher **um bar** e **uma hamburgueria** para a confraternização. Cada segmento possui cinco lugares, **scrollytelling** no desktop, galeria de fotos, localização no Google Maps, botão de voto e placar atualizado a cada 15 segundos.

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

A aplicação cria automaticamente a tabela `afterhours_votes`. O banco guarda somente o **HMAC-SHA256 do e-mail**, a categoria e o ID do local, nunca o e-mail em texto claro ou o nome informado. Quem usa o mesmo e-mail novamente altera o voto anterior naquela categoria. Um e-mail pode votar uma vez em **cada** categoria.

**Atenção:** este mecanismo não confirma a posse do e-mail. Para uma enquete informal, combine-o com `VOTE_ACCESS_CODE` compartilhado apenas com o time. Para eleição formal ou exigência forte de um voto por pessoa, implemente confirmação de e-mail ou login corporativo.

## 4. Publicar no Render

1. No Render, acesse **New → Blueprint** e conecte o repositório que contém `render.yaml`. Alternativamente, crie um **Web Service** usando `npm install && npm run build` no build e `npm start` na inicialização.
2. Configure as variáveis de ambiente no painel do serviço:
   - `DATABASE_URL`: **obrigatória para votos persistentes**.
   - `VOTE_SECRET`: segredo aleatório longo para gerar hash estável dos e-mails. O blueprint gera um automaticamente.
   - `VOTE_ACCESS_CODE`: opcional, senha da votação compartilhada com o time.
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

Exemplo de requisição de voto (localmente, quando `VOTE_ACCESS_CODE` estiver vazio):

```bash
curl -X POST http://localhost:4000/api/votes \
  -H "Content-Type: application/json" \
  -d '{"name":"Maria","email":"maria@empresa.com","category":"bars","venueId":"bar-curtica"}'
```

## Limitações e considerações

- O placar é atualizado por **polling a cada 15 segundos** (não usa WebSockets).
- A proteção contra abuso é básica (rate limit por IP em memória, um registro por hash/e-mail/categoria). Não é um sistema eleitoral auditável.
- Sem `DATABASE_URL`, o site funciona em modo demonstração, com aviso explícito de que os votos podem desaparecer no Render.
- O Google Maps iframe depende de acesso à internet e das políticas do Google; o link **Traçar rota** funciona como alternativa.
- Fotografias e preços/rodízios podem mudar com o tempo. Confirme o funcionamento de cada casa antes de fazer a reserva.
- O arquivo `design-tokens.json` facilita o trabalho no Figma; o projeto não inclui um arquivo nativo Figma, nem arquivos Blender/Spline. O 3D é renderizado diretamente com Three.js.

Feito para a confraternização do time. ✨
