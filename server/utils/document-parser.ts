import * as fs from 'fs';
import * as path from 'path';
import * as mammoth from 'mammoth';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

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
    console.log(`Starting to parse document: ${filePath} (type: ${fileType})`);
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
    console.error(`Error parsing document: ${error instanceof Error ? error.message : String(error)}`);
    throw new Error('Failed to parse document');
  }
}

async function parsePDF(filePath: string): Promise<ParsedDocument> {
  try {
    console.log('Reading PDF file...');
    const dataBuffer = fs.readFileSync(filePath);
    console.log('Parsing PDF content...');
    const data = await pdfParse(dataBuffer);

    return {
      content: data.text,
      metadata: {
        format: 'pdf',
        pageCount: data.numpages,
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
    console.log('Reading DOCX file...');
    const buffer = fs.readFileSync(filePath);
    console.log('Extracting DOCX content...');
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
    console.log('Reading TXT file...');
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