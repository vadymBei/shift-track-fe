import { Component } from '@angular/core';
import {DecimalPipe, NgClass} from "@angular/common";

type SalaryStatus = 'paid' | 'pending';

interface SalaryEmployee {
  name: string;
  position: string;
  avatar: string;
  period: string;
  hours: number;
  rate: number;
  salary: number;
  status: SalaryStatus;
  timeline: Array<{
    date: string;
    time: string;
    totalHours: number;
  }>;
  note: string;
}

@Component({
  selector: 'app-salary-page',
  standalone: true,
  imports: [
    NgClass,
    DecimalPipe
  ],
  templateUrl: './salary-page.component.html',
  styleUrl: './salary-page.component.scss'
})
export class SalaryPageComponent {
  employees: SalaryEmployee[] = [
    {
      name: 'Іван Петренко',
      position: 'Менеджер',
      avatar: 'https://i.pravatar.cc/96?img=12',
      period: '1 травня - 31 травня',
      hours: 160,
      rate: 10,
      salary: 1600,
      status: 'paid',
      timeline: [
        { date: '01.05', time: '08:00 — 16:00', totalHours: 8 },
        { date: '02.05', time: '08:00 — 16:00', totalHours: 8 },
        { date: '03.05', time: '16:00 — 00:00', totalHours: 8 }
      ],
      note: 'Виплачено'
    },
    {
      name: 'Марія Мартиненко',
      position: 'Онлайн 2 год 52 хв',
      avatar: 'https://i.pravatar.cc/96?img=5',
      period: '1 травня - 31 травня',
      hours: 148,
      rate: 10,
      salary: 1480,
      status: 'pending',
      timeline: [
        { date: '01.05', time: '09:00 — 17:00', totalHours: 8 },
        { date: '02.05', time: '09:00 — 17:00', totalHours: 8 },
        { date: '03.05', time: '10:00 — 18:00', totalHours: 8 }
      ],
      note: 'Очікує'
    },
    {
      name: 'Ірина Коваль',
      position: 'Онлайн',
      avatar: 'https://i.pravatar.cc/96?img=32',
      period: '1 травня - 31 травня',
      hours: 132,
      rate: 9,
      salary: 1188,
      status: 'pending',
      timeline: [
        { date: '01.05', time: '08:00 — 16:00', totalHours: 8 },
        { date: '02.05', time: '12:00 — 20:00', totalHours: 8 },
        { date: '03.05', time: '16:00 — 00:00', totalHours: 8 }
      ],
      note: 'Очікує'
    }
  ];

  selectedEmployee: SalaryEmployee | null = this.employees[0];

  selectEmployee(employee: SalaryEmployee): void {
    this.selectedEmployee = employee;
  }

  closeDetails(): void {
    this.selectedEmployee = null;
  }

  trackByName(_: number, employee: SalaryEmployee): string {
    return employee.name;
  }

  get totalSalary(): number {
    return this.employees.reduce((sum, employee) => sum + employee.salary, 0);
  }

  get totalHours(): number {
    return this.employees.reduce((sum, employee) => sum + employee.hours, 0);
  }

  get paidCount(): number {
    return this.employees.filter(employee => employee.status === 'paid').length;
  }
}
