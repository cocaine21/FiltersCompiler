/* globals module, require, console */

module.exports = (function () {

    'use strict';

    /**
     * @typedef {Object} fs
     * @property {function} readFileSync
     */
    const fs = require('fs');
    const CssSelectorParser = require('css-selector-parser').CssSelectorParser;

    const logger = require("./utils/log.js");
    const ruleParser = require("./rule/rule-parser.js");
    const RuleTypes = require("./rule/rule-types.js");
    const RuleMasks = require("./rule/rule-masks.js");
    const Rule = require("./rule/rule.js");

    const VALID_OPTIONS = [
        // Basic modifiers
        'domain', '~domain',
        'third-party', '~third-party',
        'popup', '~popup',
        'match-case', '~match-case',
        // Special behaviour modifiers
        'csp',
        'webrtc',
        'websocket', '~websocket',
        // Content type modifiers
        'image', '~image',
        'stylesheet', '~stylesheet',
        'script', '~script',
        'object', '~object',
        'object-subrequest', '~object-subrequest',
        'font', '~font',
        'media', '~media',
        'subdocument', '~subdocument',
        'xmlhttprequest', '~xmlhttprequest',
        'other', '~other',
        // Exception rules modifiers
        'elemhide',
        'content',
        'jsinject',
        'urlblock',
        'document', '~document',
        'stealth',
        'generichide',
        'genericblock',
        'important',
        'empty',
        'mp4',
        'extension', '~extension',
        'network',
        'replace',
        'protobuf',
        'collapse', '~collapse',
        'ping',
        'app'];

    /**
     * The problem with pseudo-classes is that any unknown pseudo-class makes browser ignore the whole CSS rule,
     * which contains a lot more selectors. So, if CSS selector contains a pseudo-class, we should try to validate it.
     * <p>
     * One more problem with pseudo-classes is that they are actively used in uBlock, hence it may mess AG styles.
     */
    const SUPPORTED_PSEUDO_CLASSES = [":active",
        ":checked", ":disabled", ":empty", ":enabled", ":first-child", ":first-of-type",
        ":focus", ":hover", ":in-range", ":invalid", ":lang", ":last-child", ":last-of-type",
        ":link", ":not", ":nth-child", ":nth-last-child", ":nth-last-of-type", ":nth-of-type",
        ":only-child", ":only-of-type", ":optional", ":out-of-range", ":read-only",
        ":read-write", ":required", ":root", ":target", ":valid", ":visited", ":has", ":has-text", ":contains",
        ":matches-css", ":matches-css-before", ":matches-css-after", ":-abp-has", ":-abp-contains"];

    /**
     * The problem with it is that ":has" and ":contains" pseudo classes are not a valid pseudo classes,
     * hence using it may break old versions of AG.
     *
     * @type {string[]}
     */
    const EXTENDED_CSS_MARKERS = ["[-ext-has=", "[-ext-contains=", "[-ext-has-text=", "[-ext-matches-css=",
        "[-ext-matches-css-before=", "[-ext-matches-css-after=", ":has(", ":has-text(", ":contains(",
        ":matches-css(", ":matches-css-before(", ":matches-css-after(", ":-abp-has(", ":-abp-contains("];

    let domainsBlacklist = [];
    let cssParser;

    /**
     * Initializes validator
     *
     * @param domainBlacklistFile
     */
    const init = function (domainBlacklistFile) {
        try {
            let s = fs.readFileSync(domainBlacklistFile, {encoding: 'utf-8'});
            if (s) {
                domainsBlacklist = s.split('\n');
            } else {
                domainsBlacklist = [];
            }
        } catch (e) {
            domainsBlacklist = [];
        }

        cssParser = new CssSelectorParser();

        cssParser.registerSelectorPseudos('has');
        cssParser.registerNestingOperators('>', '+', '~');
        cssParser.registerAttrEqualityMods('^', '$', '*', '~');
        cssParser.enableSubstitutes();
    };

    /**
     * Parses css rule selector
     *
     * @param selector
     */
    const parseCssSelector = function (selector) {

        try {
            return cssParser.parse(selector);
        } catch (e) {
            return null;
        }
    };

    /**
     * Recursively validates pseudo classes in css selector parse result object
     */
    const validatePseudoClasses = function (obj) {
        if (obj.type === 'selectors') {
            return obj.selectors.every((s) => {
                return validatePseudoClasses(s);
            });
        } else if (obj.type === 'ruleSet') {
            return validatePseudoClasses(obj.rule);
        } else if (obj.type === 'rule') {
            if (obj.pseudos) {
                return obj.pseudos.every((p) => {
                    return SUPPORTED_PSEUDO_CLASSES.indexOf(':' + p.name) >= 0;
                });
            }
        }

        return true;
    };

    /**
     * Filters blacklisted domains
     *
     * @param domains
     * @param rule
     * @param excluded
     * @returns boolean
     */
    const removeBlacklistedDomains = function (domains, rule, excluded) {
        if (domainsBlacklist.length === 0) {
            return domains;
        }

        return domains.filter((d) => {
            if (domainsBlacklist.indexOf(d) >= 0) {
                logger.error(`Blacklisted domain: ${d}`);

                if (excluded) {
                    excluded.push(`! ${d} is blacklisted: `);
                    excluded.push(rule);
                }

                return false;
            }

            return true;
        });
    };

    /**
     * Validates list of rules with black list of domains
     * returns modified list of rules without blacklisted domain options
     */
    const blacklistDomains = function (list, excluded) {
        const result = [];

        list.forEach((line) => {
            let corrected = line;
            const rule = ruleParser.parseRule(line);

            if (rule.ruleType === RuleTypes.UrlBlocking) {
                let modifiers = rule.modifiers;
                if (modifiers.domain) {
                    const validated = removeBlacklistedDomains(modifiers.domain, line, excluded);
                    if (validated.length === 0) {
                        logger.error(`All domains are blacklisted for rule: ${line}`);

                        if (excluded) {
                            excluded.push('! All domains are blacklisted for rule:');
                            excluded.push(line);
                        }

                        return;
                    }

                    modifiers.domain = validated;

                    corrected = rule.buildNewModifiers(modifiers);
                    if (rule.whiteList) {
                        corrected = RuleMasks.MASK_WHITE_LIST + corrected;
                    }
                }
            } else if (rule.ruleType === RuleTypes.ElementHiding || rule.ruleType === RuleTypes.Css ||
                rule.ruleType === RuleTypes.Content || rule.ruleType === RuleTypes.Script) {

                if (rule.domains) {
                    const validated = removeBlacklistedDomains(rule.domains, line, excluded);
                    if (validated.length === 0) {
                        logger.error(`All domains are blacklisted for rule: ${line}`);

                        if (excluded) {
                            excluded.push('! All domains are blacklisted for rule:');
                            excluded.push(line);
                        }

                        return;
                    }

                    corrected = Rule.buildNewLeadingDomainsRuleText(rule.contentPart, validated, rule.mask);
                }
            }

            result.push(corrected);
        });

        return result;
    };

    /**
     * Validates option name
     *
     * @param option
     * @returns {boolean}
     */
    const validateOptionName = function (option) {
        option = option.trim();
        return VALID_OPTIONS.indexOf(option) >= 0;
    };

    /**
     * Validates list of rules
     *
     * @param list
     * @param excluded
     * @returns {Array}
     */
    const validate = function (list, excluded) {
        return list.filter((s) => {
            const rule = ruleParser.parseRule(s);

            if (rule.ruleType === RuleTypes.Comment) {
                return true;
            } else if (rule.ruleType === RuleTypes.ElementHiding) {
                if (s.startsWith('||')) {
                    logger.error(`|| are unnecessary for element hiding rule: ${s}`);

                    if (excluded) {
                        excluded.push('! || are unnecessary for element hiding rule:');
                        excluded.push(rule.ruleText);
                    }

                    return false;
                }

                const isExtendedCss = EXTENDED_CSS_MARKERS.some((m) => rule.contentPart.includes(m));
                if (isExtendedCss) {
                    //TODO: Some extended css selector couldn't be parsed yet, so we cannot validate pseudos
                    // if (!validatePseudoClasses(cssSelector)) {
                    //     logger.error(`Invalid pseudo class: ${s}`);
                    //     return false;
                    // }

                    return true;
                }

                let cssSelector = parseCssSelector(rule.contentPart);
                if (!cssSelector) {
                    logger.error(`Invalid selector: ${s}`);

                    if (excluded) {
                        excluded.push('! Invalid selector:');
                        excluded.push(rule.ruleText);
                    }
                    return false;
                }

            } else if (rule.ruleType === RuleTypes.UrlBlocking) {
                // TODO: There is no way to separate content rules from incorrect $$ options separator
                // if (s.includes('$$')) {
                //     logger.error(`Invalid rule: ${s} - two option separators.`);
                //     return false;
                // }

                let modifiers = rule.modifiers;
                for (let name in modifiers) {
                    if (!validateOptionName(name)) {
                        logger.error(`Invalid rule options: ${s}`);

                        if (excluded) {
                            excluded.push('! Invalid rule options:');
                            excluded.push(rule.ruleText);
                        }
                        return false;
                    }
                }
            }

            //TODO: Check js rules validation

            return true;
        });
    };

    return {
        init: init,
        validate: validate,
        blacklistDomains: blacklistDomains
    };
})();

