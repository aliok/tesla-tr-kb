# Tesla TR Bilgi Bankası

Türkiye'deki Tesla sahipleri ve meraklıları için sık sorulan sorular ve cevapları.

Telegram gruplarında tekrar tekrar sorulan sorulara doğrudan link paylaşmak için tasarlanmıştır. Her sorunun kendine özel bir URL'si vardır.

## Kullanım

Bir soruya doğrudan link vermek için URL'nin sonuna `#soru-id` ekleyin:

```
https://SITE_URL/pages/genel.html#neden-tesla
```

Sayfa açıldığında ilgili soru otomatik olarak açılır ve ekrana kaydırılır.

## Geliştirme

```bash
nvm install
nvm use
npm install
npm run build
npx serve dist
```

Katkıda bulunmak için [AGENTS.md](AGENTS.md) dosyasına bakınız.

## Dağıtım

Site, Netlify üzerinden `main` branch'e push yapıldığında otomatik olarak yayınlanır.
