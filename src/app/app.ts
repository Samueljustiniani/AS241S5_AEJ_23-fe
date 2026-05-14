import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ReactiveFormsModule, Validators, FormBuilder } from '@angular/forms';
import { finalize } from 'rxjs';
import { ConsultaApiService, ConsultaRecord, ConsultaViewFilter, TtsHistoryRecord, TtsViewFilter } from './consultas-api.service';

@Component({
  selector: 'app-root',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ConsultaApiService);

  protected readonly title = 'Consultas IA';
  protected readonly subtitle = 'CRUD reactivo con Angular + WebFlux + PostgreSQL';
  protected readonly filters: Array<{ value: ConsultaViewFilter; label: string; hint: string }> = [
    { value: 'activas', label: 'Activas', hint: 'Vigentes en la base' },
    { value: 'todas', label: 'Todas', hint: 'Historial completo' },
    { value: 'inactivas', label: 'Eliminadas', hint: 'Borrado lógico' }
  ];

  protected consultas: ConsultaRecord[] = [];
  protected ttsHistory: TtsHistoryRecord[] = [];
  protected selectedFilter: ConsultaViewFilter = 'activas';
  protected selectedTtsFilter: TtsViewFilter = 'activas';
  protected isLoading = false;
  protected feedback = 'Crea una consulta para guardar la respuesta de la IA en la base de datos.';
  protected editingId: number | null = null;
  protected audioUrl: string | null = null;
  protected audioMessage = 'Genera una locución con la segunda API de IA para demostrar el servicio de voz.';
  protected readonly ttsFilters: Array<{ value: TtsViewFilter; label: string; hint: string }> = [
    { value: 'activas', label: 'Activos', hint: 'Audio disponible' },
    { value: 'todas', label: 'Todos', hint: 'Historial completo' },
    { value: 'inactivas', label: 'Eliminados', hint: 'Borrado lógico' }
  ];

  protected readonly consultaForm = this.fb.group({
    pregunta: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(500)]]
  });

  protected readonly ttsForm = this.fb.group({
    input: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(800)]] ,
    instructions: ['Lee la respuesta con tono claro y natural.'],
    model: ['tts-1'],
    voice: ['alloy']
  });

  ngOnInit(): void {
    this.loadConsultas();
    this.loadTtsHistory();
  }

  ngOnDestroy(): void {
    this.revokeAudioUrl();
  }

  protected get consultasVisibles(): ConsultaRecord[] {
    return this.consultas.filter((consulta) => {
      if (this.selectedFilter === 'todas') {
        return true;
      }

      return this.selectedFilter === 'activas' ? consulta.status === 1 : consulta.status === 0;
    });
  }

  protected get activasCount(): number {
    return this.consultas.filter((consulta) => consulta.status === 1).length;
  }

  protected get inactivasCount(): number {
    return this.consultas.filter((consulta) => consulta.status === 0).length;
  }

  protected get totalCount(): number {
    return this.consultas.length;
  }

  protected get ttsHistoryVisible(): TtsHistoryRecord[] {
    return this.ttsHistory.filter((item) => {
      if (this.selectedTtsFilter === 'todas') {
        return true;
      }

      return this.selectedTtsFilter === 'activas' ? item.status === 1 : item.status === 0;
    });
  }

  protected get ttsActiveCount(): number {
    return this.ttsHistory.filter((item) => item.status === 1).length;
  }

  protected get ttsInactiveCount(): number {
    return this.ttsHistory.filter((item) => item.status === 0).length;
  }

  protected get ttsTotalCount(): number {
    return this.ttsHistory.length;
  }

  protected setFilter(filter: ConsultaViewFilter): void {
    this.selectedFilter = filter;
  }

  protected setTtsFilter(filter: TtsViewFilter): void {
    this.selectedTtsFilter = filter;
  }

  protected startNewConsultation(): void {
    this.editingId = null;
    this.consultaForm.reset({ pregunta: '' });
    this.feedback = 'Listo para una nueva consulta.';
  }

  protected editConsultation(consulta: ConsultaRecord): void {
    this.editingId = consulta.id;
    this.consultaForm.setValue({ pregunta: consulta.pregunta });
    this.feedback = `Editando la consulta #${consulta.id}. La respuesta se recalculará con la IA.`;
  }

  protected saveConsultation(): void {
    if (this.consultaForm.invalid) {
      this.consultaForm.markAllAsTouched();
      return;
    }

    const pregunta = this.consultaForm.value.pregunta?.trim() ?? '';
    const payload = { pregunta };

    this.isLoading = true;

    const request$ = this.editingId === null
      ? this.api.createConsulta(payload)
      : this.api.updateConsulta(this.editingId, payload);

    request$
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: () => {
          this.feedback = this.editingId === null
            ? 'Consulta registrada y respuesta guardada en PostgreSQL.'
            : 'Consulta actualizada y respuesta regenerada con la IA.';
          this.selectedFilter = 'activas';
          this.startNewConsultation();
          this.loadConsultas();
        },
        error: () => {
          this.feedback = 'No se pudo guardar la consulta. Revisa que el backend esté levantado y que las llaves IA existan.';
        }
      });
  }

  protected deleteConsultation(consulta: ConsultaRecord): void {
    if (typeof window !== 'undefined' && !window.confirm(`¿Deseas eliminar lógicamente la consulta #${consulta.id}?`)) {
      return;
    }

    this.isLoading = true;
    this.api.deleteConsulta(consulta.id)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: () => {
          this.feedback = `La consulta #${consulta.id} quedó inactiva sin borrarse físicamente.`;
          if (this.editingId === consulta.id) {
            this.startNewConsultation();
          }
          this.loadConsultas();
        },
        error: () => {
          this.feedback = 'No se pudo eliminar la consulta.';
        }
      });
  }

  protected restoreConsultation(consulta: ConsultaRecord): void {
    this.isLoading = true;
    this.api.restoreConsulta(consulta.id)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: () => {
          this.feedback = `La consulta #${consulta.id} fue reactivada correctamente.`;
          this.selectedFilter = 'activas';
          this.loadConsultas();
        },
        error: () => {
          this.feedback = 'No se pudo reactivar la consulta.';
        }
      });
  }

  protected generateVoice(): void {
    if (this.ttsForm.invalid) {
      this.ttsForm.markAllAsTouched();
      return;
    }

    const payload = {
      input: this.ttsForm.value.input?.trim() ?? '',
      instructions: this.ttsForm.value.instructions ?? '',
      model: this.ttsForm.value.model ?? 'tts-1',
      voice: this.ttsForm.value.voice ?? 'alloy'
    };

    this.isLoading = true;
    this.audioMessage = 'Generando audio con la API de Text-to-Speech...';

    this.api.generateSpeech(payload)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (blob) => {
          this.revokeAudioUrl();
          this.audioUrl = URL.createObjectURL(blob);
          this.audioMessage = 'Audio listo. Puedes reproducir la respuesta generada aquí mismo.';
          this.loadTtsHistory();
        },
        error: () => {
          this.audioMessage = 'No se pudo generar el audio. Verifica el backend y la configuración TTS.';
        }
      });
  }

  protected loadTtsFromHistory(item: TtsHistoryRecord): void {
    this.ttsForm.patchValue({
      input: item.inputText,
      instructions: this.ttsForm.value.instructions ?? 'Lee la respuesta con tono claro y natural.',
      model: this.ttsForm.value.model ?? 'tts-1',
      voice: this.ttsForm.value.voice ?? 'alloy'
    });
    this.audioMessage = `Texto cargado desde el historial TTS #${item.id}. Puedes regenerarlo.`;
  }

  protected deleteTtsHistory(item: TtsHistoryRecord): void {
    this.isLoading = true;
    this.api.deleteTtsHistory(item.id)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: () => {
          this.audioMessage = `El audio #${item.id} quedó inactivo.`;
          this.loadTtsHistory();
        },
        error: () => {
          this.audioMessage = 'No se pudo eliminar el audio del historial.';
        }
      });
  }

  protected restoreTtsHistory(item: TtsHistoryRecord): void {
    this.isLoading = true;
    this.api.restoreTtsHistory(item.id)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: () => {
          this.audioMessage = `El audio #${item.id} fue reactivado.`;
          this.selectedTtsFilter = 'activas';
          this.loadTtsHistory();
        },
        error: () => {
          this.audioMessage = 'No se pudo reactivar el audio.';
        }
      });
  }

  protected ttsAudioUrl(item: TtsHistoryRecord): string {
    return `http://localhost:9090/api/tts/history/${item.id}/audio`;
  }

  protected refresh(): void {
    this.loadConsultas();
  }

  protected formatDate(value: string | null | undefined): string {
    if (!value) {
      return 'Sin fecha';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleString('es-PE', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  }

  protected preview(text: string, maxLength = 160): string {
    if (!text) {
      return '';
    }

    return text.length > maxLength ? `${text.slice(0, maxLength).trim()}...` : text;
  }

  protected statusLabel(status: number | null | undefined): string {
    return status === 1 ? 'Activa' : 'Eliminada';
  }

  protected statusClass(status: number | null | undefined): string {
    return status === 1 ? 'state-active' : 'state-inactive';
  }

  protected trackById(_: number, consulta: ConsultaRecord): number {
    return consulta.id;
  }

  private loadConsultas(): void {
    this.isLoading = true;
    this.api.getConsultas()
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (consultas) => {
          this.consultas = [...consultas].sort((left, right) => {
            const leftTime = new Date(left.fechaRegistro ?? 0).getTime();
            const rightTime = new Date(right.fechaRegistro ?? 0).getTime();
            return rightTime - leftTime;
          });
        },
        error: () => {
          this.feedback = 'No se pudo cargar el historial. Revisa el backend.';
        }
      });
  }

  private loadTtsHistory(): void {
    this.isLoading = true;
    this.api.getTtsHistory()
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (history) => {
          this.ttsHistory = [...history].sort((left, right) => {
            const leftTime = new Date(left.createdAt ?? 0).getTime();
            const rightTime = new Date(right.createdAt ?? 0).getTime();
            return rightTime - leftTime;
          });
        },
        error: () => {
          this.audioMessage = 'No se pudo cargar el historial de audio.';
        }
      });
  }

  private revokeAudioUrl(): void {
    if (this.audioUrl) {
      URL.revokeObjectURL(this.audioUrl);
      this.audioUrl = null;
    }
  }
}
