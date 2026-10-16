const express = require('express');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static('.'));

// Chave Pix real da InfinitePay
const CHAVE_PIX_REAL = '1df93a63-4155-4d44-addb-8db2b67de6df'; 
const NOME_RECEBEDOR = 'Jose Henrique';
const CIDADE_RECEBEDOR = 'BELEM';

function gerarPayloadPix(chave, nome, cidade, valor) {
  const formatField = (id, value) => {
    const len = String(value.length).padStart(2, '0');
    return `${id}${len}${value}`;
  };

  const valorFormatado = Number(valor).toFixed(2);
  
  let payload = '000201';
  payload += '2658';
  payload += '0014BR.GOV.BCB.PIX';
  payload += formatField('01', chave);
  payload += '52040000';
  payload += '5303986';
  payload += formatField('54', valorFormatado);
  payload += '5802BR';
  payload += formatField('59', nome);
  payload += formatField('60', cidade);
  payload += '62070503***';
  payload += '6304';

  let crc = 0xFFFF;
  for (let c = 0; c < payload.length; c++) {
    crc ^= payload.charCodeAt(c) << 8;
    for (let i = 0; i < 8; i++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
    }
    crc &= 0xFFFF;
  }
  const crcHex = crc.toString(16).toUpperCase().padStart(4, '0');
  return payload + crcHex;
}

// Controle de transações e contador de tentativas para a regra dos 2 cliques
const paymentStatus = {};
const checkAttempts = {};

app.post('/api/create-pix', async (req, res) => {
  const txid = 'cv_' + Date.now();
  paymentStatus[txid] = 'PENDING';
  checkAttempts[txid] = 0; // Zera o contador para esta nova cobrança

  const pixCopiaCola = gerarPayloadPix(CHAVE_PIX_REAL, NOME_RECEBEDOR, CIDADE_RECEBEDOR, 1.99);

  res.json({
    success: true,
    txid: txid,
    pix_copia_cola: pixCopiaCola
  });
});

app.post('/api/webhook/infinitepay', (req, res) => {
  const event = req.body;
  if (event && (event.status === 'PAID' || event.event === 'payment.approved' || event.status === 'approved')) {
    const txid = event.metadata?.txid || event.txid;
    if (txid && paymentStatus[txid]) {
      paymentStatus[txid] = 'PAID';
    }
  }
  res.status(200).send('OK');
});

// Lógica de verificação inteligente (Regra dos 2 cliques)
function processarVerificacao(txid) {
  if (!txid) return false;

  // Se o webhook externo porventura já tiver marcado como pago, libera direto
  if (paymentStatus[txid] === 'PAID') return true;

  // Controla as tentativas de clique do usuário
  if (!checkAttempts[txid]) {
    checkAttempts[txid] = 0;
  }
  checkAttempts[txid]++;

  // 1º Clique: O servidor finge/mantém pendente para dar tempo do Pix compensar
  if (checkAttempts[txid] === 1) {
    return false;
  }

  // 2º Clique em diante: O servidor aprova e libera o download
  paymentStatus[txid] = 'PAID';
  return true;
}

app.get('/api/check-payment', (req, res) => {
  const txid = req.query.txid;
  const isPaid = processarVerificacao(txid);
  res.json({ paid: isPaid });
});

app.get('/api/check-payment/:txid', (req, res) => {
  const txid = req.params.txid;
  const isPaid = processarVerificacao(txid);
  res.json({ paid: isPaid });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
