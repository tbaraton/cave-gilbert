// Conversion HTML → PDF côté serveur.
// Sur Vercel : utilise @sparticuz/chromium (binaire serverless).
// Sur o2switch (Node classique) : il suffira de remplacer ces imports par puppeteer plein
// et de supprimer l'appel à chromium.executablePath().

import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium'

export async function htmlToPdf(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: { width: 1240, height: 1754, deviceScaleFactor: 1 },
    executablePath: await chromium.executablePath(),
    headless: true,
  })
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'load' })
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '12mm', bottom: '12mm', left: '10mm', right: '10mm' },
    })
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}
