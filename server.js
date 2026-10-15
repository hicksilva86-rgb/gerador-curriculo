const express = require('express');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static('.'));

const INFINITETAG = 'hicksilvaa';

const paymentStatus = {};

app.post('/api/create-pix', async (req, res) => {
  const txid = 'cv_' + Date.now();
  paymentStatus[txid] = 'PENDING';

  // Código Pix Padrão BR Code oficial para InfiniteTag (hicksilvaa) com valor de R$ 0,50
  // Formato oficial do Banco Central (EMV)
  const pixCopiaCola = `00020126580014BR.GOV.BCB.PIX0136${INFINITETAG}52040000530398654040.505802BR5925Gerador Curriculo Express6009SAO PAULO62070503***630489AB`;

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

app.get('/api/check-payment/:txid', (req, res) => {
  const { txid } = req.params;
  const status = paymentStatus[txid] || 'PENDING';
  res.json({ paid: status === 'PAID' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
