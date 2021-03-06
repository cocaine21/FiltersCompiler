/* globals require, QUnit, __dirname */

/**
 * @typedef {Object} assert
 * @property {function} equal
 * @property {function} ok
 * @property {function} notOk
 */

/**
 * @typedef {Object} path
 * @property {function} join
 */

QUnit.test("Test css validation", function (assert) {
    'use strict';

    const validator = require("../main/validator.js");
    validator.init();

    let rules = ['example.com##.div'];
    assert.ok(validator.validate(rules).length > 0);
    rules = ['example.com###div-id'];
    assert.ok(validator.validate(rules).length > 0);
    rules = ['example.com##a[href^=/], .container:has(nav) > a[href]:lt($var)'];
    assert.ok(validator.validate(rules).length > 0);
    rules = ['example.com##%'];
    assert.notOk(validator.validate(rules).length > 0);
});

QUnit.test("Test incorrect rules", function (assert) {
    'use strict';

    const validator = require("../main/validator.js");
    validator.init();

    const rules = ['||example.com##.div',
        'test$domain=yandex.ru,google.com'];
    assert.ok(validator.validate(rules).length === 0);
});

QUnit.test("Test blacklist domains - ulr/css rules", (assert) => {
    'use strict';

    const before = `
||graph.com^$domain=google.com
||graph.facebook.com^$domain=jp.gocro.smartnews.android|onemore.ru|google.com|plus.one
||image.winudf.com/*/upload/promopure/$~third-party,empty,domain=apkpure.com|yahoo.com
example.com##.div
google.com###id
google.com,one.com##a[href^=/], .container:has(nav) > a[href]:lt($var)
@@||graph.com^$domain=not-google.com
`;

    const path = require('path');
    const domainsBlacklist = path.join(__dirname, './resources/domains-blacklist.txt');

    const validator = require("../main/validator.js");
    validator.init(domainsBlacklist);

    const after = validator.blacklistDomains(before.trim().split('\n'));

    assert.ok(after);
    assert.equal(after.length, 5);

    const correct = `
||graph.facebook.com^$domain=jp.gocro.smartnews.android|onemore.ru|plus.one
||image.winudf.com/*/upload/promopure/$~third-party,empty,domain=apkpure.com
example.com##.div
one.com##a[href^=/], .container:has(nav) > a[href]:lt($var)
@@||graph.com^$domain=not-google.com`;

    assert.equal(after.join('\n').trim(), correct.trim());
});

QUnit.test("Test ext-css validation", function (assert) {
    'use strict';

    const validator = require("../main/validator.js");
    validator.init();

    let selector = "#main > table.w3-table-all.notranslate:first-child > tbody > tr:nth-child(17) > td.notranslate:nth-child(2)";
    let ruleText = "w3schools.com##" + selector;
    let rules = [ruleText];
    assert.ok(validator.validate(rules).length > 0);

    selector = "#:root div.ads";
    ruleText = "w3schools.com##" + selector;
    rules = [ruleText];
    assert.ok(validator.validate(rules).length > 0);

    selector = "#body div[attr='test']:first-child  div";
    ruleText = "w3schools.com##" + selector;
    rules = [ruleText];
    assert.ok(validator.validate(rules).length > 0);

    // TODO: Should work after extended-css validation
    // selector = ".todaystripe::after";
    // ruleText = "w3schools.com##" + selector;
    // rules = [ruleText];
    // assert.ok(validator.validate(rules).length > 0);

    selector = ".todaystripe:matches-css(display: block)";
    ruleText = "w3schools.com##" + selector;
    rules = [ruleText];
    assert.ok(validator.validate(rules).length > 0);

    selector = ".todaystripe:matches-css-before(display: block)";
    ruleText = "w3schools.com##" + selector;
    rules = [ruleText];
    assert.ok(validator.validate(rules).length > 0);

    selector = ".todaystripe:matches-css-after(display: block)";
    ruleText = "w3schools.com##" + selector;
    rules = [ruleText];
    assert.ok(validator.validate(rules).length > 0);

    selector = ".todaystripe:has(.banner)";
    ruleText = "w3schools.com##" + selector;
    rules = [ruleText];
    assert.ok(validator.validate(rules).length > 0);

    selector = ".todaystripe:contains(test)";
    ruleText = "w3schools.com##" + selector;
    rules = [ruleText];
    assert.ok(validator.validate(rules).length > 0);

    //Invalid pseudo class
    // TODO: Should work after extended-css validation
    // ruleText = "yandex.ru##[-ext-has=test]:matches(.whatisthis)";
    // rules = [ruleText];
    // assert.notOk(validator.validate(rules).length > 0);

    // TODO: Should work after extended-css validation
    // ruleText = "yandex.ru##[-ext-has=test]:matches(.whatisthis), .todaystripe:contains(test)";
    // rules = [ruleText];
    // assert.notOk(validator.validate(rules).length > 0);

    ruleText = "drive2.ru##.l-main.js-main div.c-block:has(div.c-header:contains(Реклама))";
    rules = [ruleText];
    assert.ok(validator.validate(rules).length > 0);

    ruleText = "drive2.ru##.l-main.js-main div.c-block:has(> div.c-header)";
    rules = [ruleText];
    assert.ok(validator.validate(rules).length > 0);
});

QUnit.test("Test content rules validation", function (assert) {
    'use strict';

    const validator = require("../main/validator.js");
    validator.init();

    let rules = ['~nigma.ru,google.com$$div[id=\"ad_text\"][wildcard=\"*teasernet*tararar*\"]'];
    assert.ok(validator.validate(rules).length > 0);
    rules = ['~nigma.ru,google.com$$div[id=\"ad_text\"][tag-content=\"teas\"\"ernet\"][max-length=\"500\"][min-length=\"50\"][wildcard=\"*.adriver.*\"][parent-search-level=\"15\"][parent-elements=\"td,table\"]'];
    assert.ok(validator.validate(rules).length > 0);
    rules = ['~nigma.ru,google.com$$div[id=\"ad_text\"][max-length=\"500000\"][min-length=\"50\"]'];
    assert.ok(validator.validate(rules).length > 0);
});

QUnit.test("Test blacklist domains - content/script rules", (assert) => {
    'use strict';

    const before = `
example.com$$script[data-src="banner1"]
google.com$$script[data-src="banner2"]
google.com,one.com$$script[data-src="banner3"]
example.com#%#window.__gaq1 = undefined;
google.com#%#window.__gaq2 = undefined;
google.com,one.com#%#window.__gaq3 = undefined;
`;

    const path = require('path');
    const domainsBlacklist = path.join(__dirname, './resources/domains-blacklist.txt');

    const validator = require("../main/validator.js");
    validator.init(domainsBlacklist);

    const after = validator.blacklistDomains(before.trim().split('\n'));

    assert.ok(after);
    assert.equal(after.length, 4);

    const correct = `
example.com$$script[data-src="banner1"]
one.com$$script[data-src="banner3"]
example.com#%#window.__gaq1 = undefined;
one.com#%#window.__gaq3 = undefined;`;

    assert.equal(after.join('\n').trim(), correct.trim());
});

QUnit.test("Test blacklist domains - cosmetic css rules", (assert) => {
    'use strict';

    const before = `
example.com,google.com#$#body { background-color: #111!important; }
one.com#$#body { background-color: #333!important; }
two.com,google.com#$#body { background-color: #333!important; }
google.com,one.com$$script[data-src="banner3"]
`;

    const path = require('path');
    const domainsBlacklist = path.join(__dirname, './resources/domains-blacklist.txt');

    const validator = require("../main/validator.js");
    validator.init(domainsBlacklist);

    const after = validator.blacklistDomains(before.trim().split('\n'));

    assert.ok(after);
    assert.equal(after.length, 4);

    const correct = `
example.com#$#body { background-color: #111!important; }
one.com#$#body { background-color: #333!important; }
two.com#$#body { background-color: #333!important; }
one.com$$script[data-src="banner3"]
`;

    assert.equal(after.join('\n').trim(), correct.trim());
});

QUnit.test("Test blacklist domains - no domain rules", function (assert) {
    'use strict';

    const before = `###PopUpWnd
||graph.com
google.com###id
example.com##.div
`;

    const path = require('path');
    const domainsBlacklist = path.join(__dirname, './resources/domains-blacklist.txt');

    const validator = require("../main/validator.js");
    validator.init(domainsBlacklist);

    const after = validator.blacklistDomains(before.trim().split('\n'));

    assert.ok(after);
    assert.equal(after.length, 3);

    const correct = `###PopUpWnd
||graph.com
example.com##.div`;

    assert.equal(after.join('\n').trim(), correct.trim());
});

QUnit.test("Test blacklist domains - replace rules", function (assert) {
    'use strict';

    const before = `###PopUpWnd
||graph.com
google.com###id
example.com##.div
||news.yandex.*/*/*-*-*-*-$replace=/Ya\[([0-9]{10\,15})\]\([\s\S]*\)\$/,script,important,domain=news.yandex.by|news.yandex.com|news.yandex.fr|news.yandex.kz|news.yandex.ru|news.yandex.ua|google.com
`;

    const path = require('path');
    const domainsBlacklist = path.join(__dirname, './resources/domains-blacklist.txt');

    const validator = require("../main/validator.js");
    validator.init(domainsBlacklist);

    const after = validator.blacklistDomains(before.trim().split('\n'));

    assert.ok(after);
    assert.equal(after.length, 4);

    const correct = `###PopUpWnd
||graph.com
example.com##.div
||news.yandex.*/*/*-*-*-*-$replace=/Ya\[([0-9]{10\,15})\]\([\s\S]*\)\$/,script,important,domain=news.yandex.by|news.yandex.com|news.yandex.fr|news.yandex.kz|news.yandex.ru|news.yandex.ua`;

    assert.equal(after.join('\n').trim(), correct.trim());
});

QUnit.test("Test validation - various rules", function (assert) {
    'use strict';

    const validator = require("../main/validator.js");
    validator.init();

    let rules = ['||onedrive.su/code/bshow.php$empty,important,~websocket'];
    assert.ok(validator.validate(rules).length > 0);
});