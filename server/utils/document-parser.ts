import * as fs from 'fs';
import * as path from 'path';
import { PDFDocument } from 'pdf-lib';
import * as mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';

export type SupportedFileType = 'pdf' | 'docx' | 'txt';

export interface ParsedDocument {
  content: string;
  metadata: {
    format: SupportedFileType;
    pageCount?: number;
    title?: string;
  };
}

export async function parseDocument(filePath: string, fileType: SupportedFileType): Promise<ParsedDocument> {
  try {
    switch (fileType) {
      case 'pdf':
        return await parsePDF(filePath);
      case 'docx':
        return await parseDOCX(filePath);
      case 'txt':
        return await parseTXT(filePath);
      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }
  } catch (error) {
    console.error(`Error parsing document: ${error}`);
    throw new Error('Failed to parse document');
  }
}

async function parsePDF(filePath: string): Promise<ParsedDocument> {
  try {
    // Load the PDF document using pdfjs-dist
    const data = new Uint8Array(fs.readFileSync(filePath));
    const doc = await pdfjsLib.getDocument(data).promise;
    const numPages = doc.numPages;
    const textContent: string[] = [];

    // Extract text from each page
    for (let i = 1; i <= numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const text = content.items
        .map((item: any) => item.str)
        .join(' ');
      textContent.push(text);
    }

    return {
      content: textContent.join('\n'),
      metadata: {
        format: 'pdf',
        pageCount: numPages,
        title: path.basename(filePath, '.pdf')
      }
    };
  } catch (error) {
    console.error('Error parsing PDF:', error);
    throw new Error('Failed to parse PDF document');
  }
}

async function parseDOCX(filePath: string): Promise<ParsedDocument> {
  try {
    const buffer = fs.readFileSync(filePath);
    const result = await mammoth.extractRawText({ buffer });

    return {
      content: result.value,
      metadata: {
        format: 'docx',
        title: path.basename(filePath, '.docx')
      }
    };
  } catch (error) {
    console.error('Error parsing DOCX:', error);
    throw new Error('Failed to parse DOCX document');
  }
}

async function parseTXT(filePath: string): Promise<ParsedDocument> {
  try {
    const content = fs.readFileSync(filePath, 'utf8');

    return {
      content,
      metadata: {
        format: 'txt',
        title: path.basename(filePath, '.txt')
      }
    };
  } catch (error) {
    console.error('Error parsing TXT:', error);
    throw new Error('Failed to parse TXT document');
  }
}

export function getFileType(filename: string): SupportedFileType {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.pdf':
      return 'pdf';
    case '.docx':
      return 'docx';
    case '.txt':
      return 'txt';
    default:
      throw new Error(`Unsupported file extension: ${ext}`);
  }
}