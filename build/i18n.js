import { I18n } from '@iobroker/gui-components';
import en from './i18n/en.json';
import de from './i18n/de.json';
import ru from './i18n/ru.json';
import pt from './i18n/pt.json';
import nl from './i18n/nl.json';
import fr from './i18n/fr.json';
import it from './i18n/it.json';
import es from './i18n/es.json';
import pl from './i18n/pl.json';
import uk from './i18n/uk.json';
import zhCn from './i18n/zh-cn.json';
let registered = false;
/** Add the texts of the panel to `I18n`. Call it once before the panel is shown */
export function registerAiTranslations() {
    if (registered) {
        return;
    }
    registered = true;
    I18n.extendTranslations({ en, de, ru, pt, nl, fr, it, es, pl, uk, 'zh-cn': zhCn });
}
//# sourceMappingURL=i18n.js.map