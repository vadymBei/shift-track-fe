import {Component, inject, OnInit, signal} from '@angular/core';
import {RouterLink} from '@angular/router';
import {catchError, map, Observable, of} from 'rxjs';
import {Skeleton} from 'primeng/skeleton';
import {UnitService} from '../../../../features/organization/structure/services/unit.service';
import {DepartmentService} from '../../../../features/organization/structure/services/department.service';
import {PositionService} from '../../../../features/organization/structure/services/position.service';
import {EmployeesService} from '../../../../features/organization/employees/services/employees.service';
import {ShiftsService} from '../../../../features/organization/timesheet/services/shifts.service';
import {pluralUk} from '../../../../shared/utils/text.utils';

interface AdminTile {
  key: string;
  title: string;
  description: string;
  icon: string;
  link: string;
  count$?: () => Observable<number>;
}

interface AdminSection {
  title: string;
  tiles: AdminTile[];
}

type CountState = number | null;

@Component({
  selector: 'app-administration-page',
  standalone: true,
  imports: [RouterLink, Skeleton],
  templateUrl: './administration-page.component.html',
  styleUrl: './administration-page.component.scss'
})
export class AdministrationPageComponent implements OnInit {
  private readonly unitService = inject(UnitService);
  private readonly departmentService = inject(DepartmentService);
  private readonly positionService = inject(PositionService);
  private readonly employeesService = inject(EmployeesService);
  private readonly shiftsService = inject(ShiftsService);

  readonly sections: AdminSection[] = [
    {
      title: 'Організація',
      tiles: [
        {
          key: 'units', title: 'Регіони', description: 'Регіони компанії та їхні коди',
          icon: 'pi pi-map', link: '/administration/units',
          count$: () => this.unitService.getUnits().pipe(map(list => list.length))
        },
        {
          key: 'departments', title: 'Департаменти', description: 'Магазини, склади й офіси за регіонами',
          icon: 'pi pi-building', link: '/administration/departments',
          count$: () => this.departmentService.getGroupedDepartmentsGroupedByUnits()
            .pipe(map(groups => groups.reduce((sum, g) => sum + g.departments.length, 0)))
        },
        {
          key: 'positions', title: 'Посади', description: 'Посади та погодинні ставки',
          icon: 'pi pi-id-card', link: '/administration/positions',
          count$: () => this.positionService.getPositions().pipe(map(list => list.length))
        }
      ]
    },
    {
      title: 'Працівники',
      tiles: [
        {
          key: 'employees', title: 'Працівники', description: 'Перегляд і редагування даних працівників',
          icon: 'pi pi-users', link: '/administration/employees',
          count$: () => this.employeesService.getAllEmployees({}).pipe(map(list => list.length))
        },
        {
          key: 'roles', title: 'Ролі працівників', description: 'Призначення ролей і доступів',
          icon: 'pi pi-shield', link: '/administration/employees-roles'
        }
      ]
    },
    {
      title: 'Робота',
      tiles: [
        {
          key: 'shifts', title: 'Робочі зміни', description: 'Типи змін і графіки роботи',
          icon: 'pi pi-clock', link: '/administration/shifts',
          count$: () => this.shiftsService.getShifts().pipe(map(list => list.length))
        }
      ]
    }
  ];

  readonly counts = signal<Record<string, CountState>>({});

  ngOnInit(): void {
    for (const tile of this.sections.flatMap(s => s.tiles)) {
      if (!tile.count$) continue;
      this.setCount(tile.key, null);
      tile.count$()
        .pipe(catchError(() => of(-1)))
        .subscribe(count => this.setCount(tile.key, count));
    }
  }

  countLabel(count: number): string {
    return pluralUk(count, 'запис', 'записи', 'записів');
  }

  private setCount(key: string, value: CountState): void {
    this.counts.update(counts => ({...counts, [key]: value}));
  }
}
