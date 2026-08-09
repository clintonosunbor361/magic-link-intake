import "server-only";

import chromium from "@sparticuz/chromium";
import { PDFDocument } from "pdf-lib";
import puppeteer from "puppeteer-core";

export type PdfMetadata = {
  title: string;
  author: string;
  subject: string;
};

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function textWithBreaks(value: string): string {
  return escapeHtml(value).replaceAll("\n", "<br>");
}

export function htmlDocument(input: { title: string; styles: string; body: string }): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(input.title)}</title><style>${input.styles}</style></head><body>${input.body}</body></html>`;
}

export async function renderHtmlToPdf(html: string, metadata: PdfMetadata): Promise<Buffer> {
  const executablePath = await resolveExecutablePath();
  const serverless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  const browser = await puppeteer.launch({
    executablePath,
    args: serverless ? await puppeteer.defaultArgs({ args: chromium.args, headless: "shell" }) : ["--no-sandbox"],
    headless: serverless ? "shell" : true,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const bytes = await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate:
        '<div style="width:100%;font:8px Arial,sans-serif;color:#777;text-align:center"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
      margin: { top: "15mm", right: "15mm", bottom: "17mm", left: "15mm" },
    });
    return applyMetadata(Buffer.from(bytes), metadata);
  } finally {
    await browser.close();
  }
}

async function resolveExecutablePath(): Promise<string> {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) return chromium.executablePath();
  const { chromium: localChromium } = await import("playwright");
  return localChromium.executablePath();
}

async function applyMetadata(bytes: Buffer, metadata: PdfMetadata): Promise<Buffer> {
  const document = await PDFDocument.load(bytes);
  document.setTitle(metadata.title);
  document.setAuthor(metadata.author);
  document.setSubject(metadata.subject);
  document.setCreator("Kuartz Fashion CRM");
  document.setProducer("Kuartz Fashion CRM");
  return Buffer.from(await document.save());
}
