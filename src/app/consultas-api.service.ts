import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export type ConsultaViewFilter = 'todas' | 'activas' | 'inactivas';

export interface ConsultaRecord {
  id: number;
  pregunta: string;
  respuesta: string;
  fechaRegistro: string;
  status: number;
}

export interface ConsultaPayload {
  pregunta: string;
}

export interface TextToSpeechPayload {
  input: string;
  instructions: string;
  model: string;
  voice: string;
}

export type TtsViewFilter = 'todas' | 'activas' | 'inactivas';

export interface TtsHistoryRecord {
  id: number;
  inputText: string;
  createdAt: string;
  status: number;
}

@Injectable({ providedIn: 'root' })
export class ConsultaApiService {
  private readonly baseUrl = 'http://localhost:9090';

  constructor(private readonly http: HttpClient) {}

  getConsultas(): Observable<ConsultaRecord[]> {
    return this.http.get<ConsultaRecord[]>(`${this.baseUrl}/api/consultas`);
  }

  createConsulta(payload: ConsultaPayload): Observable<ConsultaRecord> {
    return this.http.post<ConsultaRecord>(`${this.baseUrl}/api/consultas`, payload);
  }

  updateConsulta(id: number, payload: ConsultaPayload): Observable<ConsultaRecord> {
    return this.http.put<ConsultaRecord>(`${this.baseUrl}/api/consultas/${id}`, payload);
  }

  deleteConsulta(id: number): Observable<ConsultaRecord> {
    return this.http.delete<ConsultaRecord>(`${this.baseUrl}/api/consultas/${id}`);
  }

  restoreConsulta(id: number): Observable<ConsultaRecord> {
    return this.http.put<ConsultaRecord>(`${this.baseUrl}/api/consultas/restore/${id}`, {});
  }

  generateSpeech(payload: TextToSpeechPayload): Observable<Blob> {
    return this.http.post(`${this.baseUrl}/api/tts`, payload, {
      responseType: 'blob'
    });
  }

  getTtsHistory(): Observable<TtsHistoryRecord[]> {
    return this.http.get<TtsHistoryRecord[]>(`${this.baseUrl}/api/tts/history`);
  }

  deleteTtsHistory(id: number): Observable<TtsHistoryRecord> {
    return this.http.delete<TtsHistoryRecord>(`${this.baseUrl}/api/tts/history/${id}`);
  }

  restoreTtsHistory(id: number): Observable<TtsHistoryRecord> {
    return this.http.put<TtsHistoryRecord>(`${this.baseUrl}/api/tts/history/restore/${id}`, {});
  }
}