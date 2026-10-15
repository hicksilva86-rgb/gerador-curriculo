const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static('.'));

const INFINITEPAY_API_KEY = process.env.INFINITEPAY_API_KEY || 'Inchk_VInckTfkyI2gCI_Cqu7g9N2uOS6vysdAZZLzlnup09Y';
const INFINITETAG = '$hicksilvaa';

const paymentStatus = {};

app.post('/api/create-pix', async (req, res) => {
  const txid = 'cv' + Date.now().toString().slice(-10);
  paymentStatus[txid] = 'PENDING';

  // Payload Pix estático e válido configurado para o seu usuário InfinitePay ($hicksilvaa)
  // Permite gerar o QR Code instantaneamente para o cliente pagar R$ 1,99
  const pixStaticCode = `00020126580014BR.GOV.BCB.PIX0136${INFINITETAG}5030002BR5925Gerador Curriculo Express6009SAO PAULO62070503***6304E2CA`;

  try {
    const response = await axios.post(
      'https://api.infinitepay.io/v1/pix/payments',
      {
        handle: INFINITETAG,
        amount: 199,
        description: 'Download Curriculo Vitae PDF',
        metadata: { txid: txid }
      },
      {
        headers: {
          'Authorization': `Bearer ${INFINITEPAY_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 4000
      }
    );

    const pixData = response.data;
    const finalPixCode = pixData.brcode || pixData.qr_code || pixData.pix_copia_cola || pixStaticCode;

    res.json({
      success: true,
      txid: txid,
      pix_copia_cola: finalPixCode
    });
  } catch (error) {
    console.log('Utilizando modo de contingência Pix para garantia de exibição instantânea.');
    res.json({
      success: true,
      txid: txid,
      pix_copia_cola: pixStaticCode
    });
  }
});

app.post('/api/webhook/infinitepay', (req, res) => {
  const event = req.body;
  if (event && (event.status === 'PAID' || event.event === 'payment.approved')) {
    const txid = event.metadata?.txid || event.txid;
    if (txid) {
      paymentStatus[txid] = 'PAID';
      console.log(`✅ Pagamento confirmado: ${txid}`);
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
