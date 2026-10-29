import { LocaleProvider, useTranslation } from '@portfolio/i18n/react';
import { type Locale } from '@portfolio/i18n';
import { Field, FieldLabel } from '@portfolio/ui/components/field';
import { NativeSelect, NativeSelectOption } from '@portfolio/ui/components/native-select';
function MaterialPickerContent() {
  const { t } = useTranslation();
  return <Field className="mt-8 max-w-xs"><FieldLabel htmlFor="material"> {t("Material")} </FieldLabel><NativeSelect id="material" data-material defaultValue="chrome"><NativeSelectOption value="chrome"> {t("Brushed chrome")} </NativeSelectOption><NativeSelectOption value="pearl"> {t("Soft pearl")} </NativeSelectOption><NativeSelectOption value="wireframe"> {t("Wireframe")} </NativeSelectOption></NativeSelect></Field>;
}

export default function MaterialPicker({ locale = 'en', ...props }: {} & { locale?: Locale }) {
  return <LocaleProvider locale={locale}><MaterialPickerContent {...props} /></LocaleProvider>;
}
