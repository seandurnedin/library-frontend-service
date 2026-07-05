import { Pipe, PipeTransform } from '@angular/core';

/** Backend enums are SCREAMING_SNAKE_CASE (IN_STORE, LATE_FEE, ...) - this just swaps the
 *  underscore for a space so labels read "IN STORE" / "LATE FEE" instead of showing the raw
 *  enum constant. */
@Pipe({ name: 'enumLabel' })
export class EnumLabelPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return value ? value.replace(/_/g, ' ') : '';
  }
}
