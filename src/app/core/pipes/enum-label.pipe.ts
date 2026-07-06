import { Pipe, PipeTransform } from '@angular/core';

/** Backend enums are SCREAMING_SNAKE_CASE (IN_STORE, LATE_FEE, ...) - this swaps the underscore
 *  for a space and uppercases, so labels read "IN STORE" / "LATE FEE" consistently even for the
 *  few endpoints that return the value lowercased (e.g. the user profile's role/status). */
@Pipe({ name: 'enumLabel' })
export class EnumLabelPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return value ? value.replace(/_/g, ' ').toUpperCase() : '';
  }
}
