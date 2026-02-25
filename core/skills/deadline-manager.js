/**
 * SKILL: Deadline Manager
 * 
 * Gerencia prazos processuais segundo o CPC brasileiro:
 * - Calcula prazos processuais (dias úteis, feriados)
 * - Envia alertas automáticos
 * - Considera diferentes tribunais e comarcas
 * - Integra com calendário
 */

const cron = require('node-cron');

class DeadlineManager {
  constructor() {
    this.deadlines = [];
    this.holidays = this.loadBrazilianHolidays();
    this.alertSchedules = new Map();
  }

  loadBrazilianHolidays(year = new Date().getFullYear()) {
    // Feriados nacionais fixos
    const fixedHolidays = [
      `${year}-01-01`, // Ano Novo
      `${year}-04-21`, // Tiradentes
      `${year}-05-01`, // Dia do Trabalho
      `${year}-09-07`, // Independência
      `${year}-10-12`, // Nossa Senhora Aparecida
      `${year}-11-02`, // Finados
      `${year}-11-15`, // Proclamação da República
      `${year}-12-25`, // Natal
    ];

    // Feriados móveis (seria necessário calcular Páscoa, Carnaval, Corpus Christi)
    // Para simplificar, adicionar manualmente ou usar biblioteca
    const movableHolidays = this.calculateMovableHolidays(year);

    return [...fixedHolidays, ...movableHolidays];
  }

  calculateMovableHolidays(year) {
    // Algoritmo simplificado para calcular Páscoa (Meeus)
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;

    const easter = new Date(year, month - 1, day);
    
    // Calcula outros feriados baseados na Páscoa
    const carnaval = new Date(easter);
    carnaval.setDate(easter.getDate() - 47);
    
    const corpusChristi = new Date(easter);
    corpusChristi.setDate(easter.getDate() + 60);

    const goodFriday = new Date(easter);
    goodFriday.setDate(easter.getDate() - 2);

    return [
      carnaval.toISOString().split('T')[0],
      goodFriday.toISOString().split('T')[0],
      corpusChristi.toISOString().split('T')[0]
    ];
  }

  isBusinessDay(date) {
    const dateStr = date.toISOString().split('T')[0];
    const dayOfWeek = date.getDay();

    // Verifica se é fim de semana
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return false;
    }

    // Verifica se é feriado
    if (this.holidays.includes(dateStr)) {
      return false;
    }

    return true;
  }

  addBusinessDays(startDate, days) {
    let currentDate = new Date(startDate);
    let addedDays = 0;

    while (addedDays < days) {
      currentDate.setDate(currentDate.getDate() + 1);
      
      if (this.isBusinessDay(currentDate)) {
        addedDays++;
      }
    }

    return currentDate;
  }

  calculateDeadline(params) {
    const {
      startDate,
      days,
      type = 'processuais', // 'processuais' (úteis) ou 'corridos'
      tribunal = 'geral'
    } = params;

    const start = new Date(startDate);
    let deadline;

    if (type === 'processuais') {
      deadline = this.addBusinessDays(start, days);
    } else {
      deadline = new Date(start);
      deadline.setDate(deadline.getDate() + days);
    }

    // Ajustes específicos por tribunal (se necessário)
    if (tribunal === 'trabalhista') {
      // TST tem regras específicas
    }

    return {
      startDate: start.toISOString().split('T')[0],
      deadline: deadline.toISOString().split('T')[0],
      businessDays: days,
      type,
      tribunal
    };
  }

  addDeadline(deadline) {
    const id = `deadline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newDeadline = {
      id,
      ...deadline,
      createdAt: new Date().toISOString(),
      alerts: deadline.alerts || ['7d', '3d', '1d', '2h'] // Alertas padrão
    };

    this.deadlines.push(newDeadline);
    this.scheduleAlerts(newDeadline);

    return newDeadline;
  }

  scheduleAlerts(deadline) {
    const deadlineDate = new Date(deadline.deadline);

    deadline.alerts.forEach(alert => {
      let alertDate = new Date(deadlineDate);

      if (alert.endsWith('d')) {
        const days = parseInt(alert);
        alertDate.setDate(alertDate.getDate() - days);
      } else if (alert.endsWith('h')) {
        const hours = parseInt(alert);
        alertDate.setHours(alertDate.getHours() - hours);
      }

      // Agendar alerta (simplificado)
      const now = new Date();
      if (alertDate > now) {
        setTimeout(() => {
          this.sendAlert(deadline, alert);
        }, alertDate - now);
      }
    });
  }

  sendAlert(deadline, alertType) {
    const message = this.generateAlertMessage(deadline, alertType);
    console.log(`🔔 ALERTA: ${message}`);
    
    // Aqui integraria com WhatsApp/Telegram
    // this.sendToMessaging(message, deadline.userId);
    
    return message;
  }

  generateAlertMessage(deadline, alertType) {
    const daysLeft = this.getBusinessDaysUntil(new Date(deadline.deadline));
    
    let urgency = '🔵';
    if (daysLeft <= 1) urgency = '🔴';
    else if (daysLeft <= 3) urgency = '🟡';

    return `${urgency} **ALERTA DE PRAZO**

📋 **${deadline.title}**
⚖️ Processo: ${deadline.processNumber || 'N/A'}
📅 Prazo final: ${new Date(deadline.deadline).toLocaleDateString('pt-BR')}
⏰ Faltam: ${daysLeft} dia(s) úteis

📝 Descrição: ${deadline.description || 'N/A'}
👤 Responsável: ${deadline.responsible || 'N/A'}

${deadline.action ? `✅ Ação necessária: ${deadline.action}` : ''}`;
  }

  getBusinessDaysUntil(targetDate) {
    let count = 0;
    let currentDate = new Date();

    while (currentDate < targetDate) {
      currentDate.setDate(currentDate.getDate() + 1);
      if (this.isBusinessDay(currentDate)) {
        count++;
      }
    }

    return count;
  }

  listUpcoming(days = 30) {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    return this.deadlines
      .filter(d => {
        const deadline = new Date(d.deadline);
        return deadline >= now && deadline <= futureDate;
      })
      .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
  }

  generateReport(upcoming) {
    if (upcoming.length === 0) {
      return '✅ Nenhum prazo nos próximos dias.';
    }

    let report = `📅 **RELATÓRIO DE PRAZOS**\n`;
    report += `Total: ${upcoming.length} prazo(s)\n\n`;

    upcoming.forEach((deadline, i) => {
      const daysLeft = this.getBusinessDaysUntil(new Date(deadline.deadline));
      const urgency = daysLeft <= 1 ? '🔴' : daysLeft <= 3 ? '🟡' : '🔵';

      report += `${urgency} **${i + 1}. ${deadline.title}**\n`;
      report += `   Processo: ${deadline.processNumber || 'N/A'}\n`;
      report += `   Prazo: ${new Date(deadline.deadline).toLocaleDateString('pt-BR')}\n`;
      report += `   Faltam: ${daysLeft} dia(s) úteis\n`;
      report += `   Responsável: ${deadline.responsible || 'N/A'}\n\n`;
    });

    return report;
  }
}

// Interface para OpenClaw
const skill = {
  name: 'deadline_manager',
  description: 'Gerencia prazos processuais',
  
  commands: {
    'calcular_prazo': async (params) => {
      const manager = new DeadlineManager();
      const result = manager.calculateDeadline(params);

      return {
        success: true,
        message: `📅 Prazo calculado:\nInício: ${result.startDate}\n**Prazo final: ${result.deadline}**\n(${result.businessDays} dias ${result.type})`,
        data: result
      };
    },

    'adicionar_prazo': async (params) => {
      const manager = new DeadlineManager();
      const deadline = manager.addDeadline(params);

      return {
        success: true,
        message: `✅ Prazo adicionado com sucesso!\nID: ${deadline.id}\nPrazo final: ${deadline.deadline}`,
        data: deadline
      };
    },

    'listar_prazos': async (params) => {
      const manager = new DeadlineManager();
      const upcoming = manager.listUpcoming(params.days || 30);
      const report = manager.generateReport(upcoming);

      return {
        success: true,
        message: report,
        data: upcoming
      };
    }
  }
};

module.exports = { DeadlineManager, skill };
