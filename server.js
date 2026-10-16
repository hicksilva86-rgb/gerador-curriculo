const express = require('express');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static('.'));

// Chave Pix aleatória real da InfinitePay
const CHAVE_PIX_REAL = '1df93a63-4155-4d44-addb-8db2b67de6df'; 
const NOME_RECEBEDOR = 'Jose Henrique';
const CIDADE_RECEBEDOR = 'BELEM';

// Função para gerar o payload Pix BR Code com cálculo CRC16 correto
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

  // Cálculo do CRC16 exigido pelo Banco Central (elimina o erro [QRCD10])
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

const paymentStatus = {};

app.post('/api/create-pix', async (req, res) => {
  const txid = 'cv_' + Date.now();
  paymentStatus[txid] = 'PENDING';

  // Gera o código Pix Copia e Cola exato para R$ 1,99 com a chave real
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
    if (txid) {
      paymentStatus[txid] = 'PAID';
    }
  }
  res.status(200).send('OK');
});

// Suporte por Query String (?txid=...)
app.get('/api/check-payment', (req, res) => {
  const txid = req.query.txid;
  const status = paymentStatus[txid] || 'PENDING';
  res.json({ paid: status === 'PAID' });
});

// Suporte por Parâmetro de Rota (/:txid)
app.get('/api/check-payment/:txid', (req, res) => {
  const txid = req.params.txid;
  const status = paymentStatus[txid] || 'PENDING';
  res.json({ paid: status === 'PAID' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
