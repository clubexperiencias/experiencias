import { Component, HostListener, signal, computed, OnInit, inject, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { FounderAdComponent } from '../../shared/components/founder-ad/founder-ad.component';
import {
  BreadcrumbComponent,
  BreadcrumbItem,
} from '../../shared/components/breadcrumb/breadcrumb.component';

export type FaqCategory = 'todas' | 'experiencias' | 'membresias' | 'reservas' | 'prestadores';

export interface FaqItem {
  id: string;
  category: FaqCategory;
  question: string;
  answer: string;
  highlight?: string;
}

@Component({
  selector: 'app-faq',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    MatIconModule,
    HeaderComponent,
    FooterComponent,
    BreadcrumbComponent,
    FounderAdComponent,
  ],
  templateUrl: './faq.component.html',
  styleUrl: './faq.component.css',
})
export class FaqComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Inicio', url: '/' },
    { label: 'Preguntas Frecuentes' },
  ];

  // Notificación flotante: Plataforma en construcción (Estilo Toast Favoritos)
  readonly showConstructionNotice = signal(false);
  private constructionTimer: any = null;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.clearConstructionTimer();
    });

    // Detectar navegaciones a '/faq' (incluso si el usuario ya está en '/faq')
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((e) => {
        const cleanUrl = (e.urlAfterRedirects || e.url || '').split('?')[0].split('#')[0];
        if (cleanUrl === '/faq') {
          this.triggerConstructionNotice();
        }
      });
  }

  ngOnInit(): void {
    this.triggerConstructionNotice();
  }

  triggerConstructionNotice(): void {
    this.clearConstructionTimer();
    this.showConstructionNotice.set(false);
    setTimeout(() => {
      this.showConstructionNotice.set(true);
      this.constructionTimer = setTimeout(() => {
        this.showConstructionNotice.set(false);
        this.constructionTimer = null;
      }, 7000);
    }, 60);
  }

  dismissConstructionNotice(): void {
    this.clearConstructionTimer();
    this.showConstructionNotice.set(false);
  }

  private clearConstructionTimer(): void {
    if (this.constructionTimer) {
      clearTimeout(this.constructionTimer);
      this.constructionTimer = null;
    }
  }

  readonly mobileMenuOpen = signal(false);
  readonly selectedCategory = signal<FaqCategory>('todas');
  readonly searchQuery = signal('');
  readonly activeFaqId = signal<string | null>(null);

  readonly categories: { id: FaqCategory; label: string }[] = [
    { id: 'todas', label: 'Todas las preguntas' },
    { id: 'experiencias', label: 'Experiencias & Salidas' },
    { id: 'membresias', label: 'Membresías & Socios' },
    { id: 'reservas', label: 'Reservas & Pagos' },
    { id: 'prestadores', label: 'Prestadores & Guías' },
  ];

  readonly faqs: FaqItem[] = [
    {
      id: 'que-es-el-club',
      category: 'experiencias',
      question: '¿Qué es EXPERIENCIAS.CLUB?',
      answer:
        'EXPERIENCIAS.CLUB es una comunidad de exploradores y montañistas diseñada para descubrir los destinos más imponentes y vírgenes de Catamarca (Puna, Volcán Galán, Balcón del Pissis, Dunas de Tatón, Laguna Blanca y más). Conectamos directamente a socios con prestadores y guías locales matriculados, garantizando seguridad, impacto positivo y tarifas preferenciales sin intermediarios innecesarios.',
      highlight: 'Comunidad andina oficial con curaduría y prestadores locales certificados.',
    },
    {
      id: 'niveles-de-socio',
      category: 'membresias',
      question: '¿Cuáles son los niveles de socio y cómo se diferencian?',
      answer:
        'Existen tres grados de participación:\n\n• Socio Emergente (Nivel 1): Registro 100% gratuito. Te asigna tu número oficial de socio, credencial digital y acceso anticipado 24h a cupos en preventa.\n\n• Socio Pleno (Nivel 2): Membresía activa con 10% OFF directo en todas las expediciones, cupo prioritario asegurado, salidas exclusivas y regalos de temporada. Inicialmente cuenta con cuota de adquisición bonificada con cupón promocional.\n\n• Socio Fundador (Nivel 3): Cupo exclusivo vitalicio para los primeros 60 socios con 20% OFF de por vida, regalos andinos y trato prioritario histórico.',
      highlight: 'Podés sumarte gratis como Socio Emergente en menos de un minuto.',
    },
    {
      id: 'fechas-a-coordinar',
      category: 'experiencias',
      question: '¿Qué significa que una expedición tenga "Fechas y Salidas a Coordinar"?',
      answer:
        'Muchas travesías de alta montaña y expediciones remotas dependen de factores meteorológicos o se arman a medida para grupos reducidos. Al reservar una experiencia con fechas a coordinar, congelás tu arancel con tarifa de socio y luego coordinás con el prestador la fecha exacta que mejor se adapte a tu viaje y a la ventana de buen tiempo.',
      highlight: 'Asegurás tu lugar y acordás la fecha con total flexibilidad.',
    },
    {
      id: 'clima-suspension',
      category: 'experiencias',
      question: '¿Qué sucede si las condiciones climáticas impiden la salida?',
      answer:
        'En montaña y travesías andinas la seguridad de cada persona es la prioridad número uno. Si por alertas de viento zonda, temporal o cortes de paso una salida debe posponerse, se coordina una reprogramación de común acuerdo. En caso de no poder reprogramar, tu saldo queda totalmente acreditado para otra experiencia o se reintegra según las políticas del prestador.',
      highlight: 'Seguridad absoluta y garantía de reprogramación sin penalidades.',
    },
    {
      id: 'reserva-pasos',
      category: 'reservas',
      question: '¿Cómo hago para reservar una experiencia?',
      answer:
        '1. Ingresá a la sección Experiencias (/experiencias) y elegí la expedición que querés realizar.\n2. Presioná "Reservar Experiencia".\n3. Seleccioná la fecha deseada (o modalidad a coordinar), la cantidad de lugares y tus datos de contacto.\n4. Si tenés un cupón de descuento, ingresalo en la casilla promocional.\n5. Aboná mediante transferencia bancaria al CBU oficial (subiendo el comprobante) o a través de Mercado Pago.\n6. Recibirás la confirmación inmediata en tu correo y en tu perfil de socio.',
      highlight: 'Confirmación digital con recibo y contacto directo con el guía.',
    },
    {
      id: 'cupon-descuento',
      category: 'reservas',
      question: '¿Cómo aplico un código de descuento promocional?',
      answer:
        'Al momento de pagar tu experiencia o de activar tu membresía de Socio Pleno, verás una casilla titulada "Código Promocional". Escribí el código provisto para tu membresía o promoción especial y presioná "Aplicar Código". El sistema recalculará automáticamente el monto con el beneficio correspondiente.',
      highlight: 'Validación instantánea en pantalla antes de finalizar el pago.',
    },
    {
      id: 'cancelar-pausar-suscripcion',
      category: 'membresias',
      question: '¿Puedo pausar o cancelar mi suscripción de Socio Pleno cuando quiera?',
      answer:
        'Sí, absolutamente. En EXPERIENCIAS.CLUB no creemos en la permanencia obligatoria. Podés pausar tu membresía durante los meses que no viajes o cancelarla en cualquier momento desde /socios/plenos o desde la pestaña de gestión en tu Perfil de Socio.',
      highlight: 'Sin permanencia obligatoria ni trámites engorrosos.',
    },
    {
      id: 'ser-prestador',
      category: 'prestadores',
      question: '¿Cómo puedo sumarme como prestador o guía local?',
      answer:
        'Si brindás servicios de turismo aventura, 4x4, trekking, cabalgatas, náutica o alojamiento de montaña en Catamarca, podés postularte en /prestadores/emergentes o a través de nuestro portal de prestadores. Nuestro equipo de curaduría evalúa tu documentación, vehículos, seguros y habilitaciones provinciales/nacionales para integrarte a la red.',
      highlight: 'Formá parte de la red oficial y recibí reservas directas sin comisiones abusivas.',
    },
    {
      id: 'equipamiento-necesario',
      category: 'experiencias',
      question: '¿Qué indumentaria o equipamiento debo llevar?',
      answer:
        'En la ficha detallada de cada experiencia encontrarás el apartado "Detalles de la Experiencia" con dos listas claras: los servicios e indumentaria provista por el prestador (ej. bastones, chalecos, cascos, vianda) y qué debés llevar vos (calzado de trekking con buen agarre, abrigo en capas, cortavientos, anteojos UV y protector solar).',
      highlight: 'Revisá la sección de Equipamiento antes de cada salida.',
    },
    {
      id: 'metodos-de-pago',
      category: 'reservas',
      question: '¿Cuáles son los métodos de pago aceptados?',
      answer:
        'Aceptamos Transferencia Bancaria Directa (CBU / Alias oficial del club, validado mediante comprobante adjunto), dinero en cuenta de Mercado Pago y tarjetas de crédito o débito a través de la pasarela segura.',
      highlight: 'Pagos protegidos con acreditación transparente.',
    },
  ];

  readonly filteredFaqs = computed(() => {
    const cat = this.selectedCategory();
    const query = this.searchQuery().toLowerCase().trim();

    return this.faqs.filter((faq) => {
      const matchCategory = cat === 'todas' || faq.category === cat;
      const matchQuery =
        !query ||
        faq.question.toLowerCase().includes(query) ||
        faq.answer.toLowerCase().includes(query) ||
        (faq.highlight && faq.highlight.toLowerCase().includes(query));

      return matchCategory && matchQuery;
    });
  });

  toggleMobileMenu(event: Event): void {
    event.stopPropagation();
    this.mobileMenuOpen.update((v) => !v);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.mobileMenuOpen.set(false);
  }

  selectCategory(category: FaqCategory): void {
    this.selectedCategory.set(category);
  }

  toggleFaq(id: string): void {
    this.activeFaqId.update((current) => (current === id ? null : id));
  }

  isOpen(id: string): boolean {
    return this.activeFaqId() === id;
  }

  clearSearch(): void {
    this.searchQuery.set('');
  }
}
