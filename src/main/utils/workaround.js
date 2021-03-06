/* globals require */

module.exports = (() => {

    'use strict';

    const RuleMasks = require('../rule/rule-masks.js');

    /**
     * CSS rules with width and height attributes break SVG rendering
     * https://github.com/AdguardTeam/AdguardBrowserExtension/issues/683
     *
     * @param ruleText Rule text
     */
    const fixCssRuleAttributesForEdge = function (ruleText) {

        if (ruleText.includes(RuleMasks.MASK_CSS) ||
            ruleText.includes(RuleMasks.MASK_CSS_EXCEPTION) ||
            ruleText.includes(RuleMasks.MASK_ELEMENT_HIDING) ||
            ruleText.includes(RuleMasks.MASK_ELEMENT_HIDING_EXCEPTION)) {

            ruleText = ruleText.replace(/\[width=/gi, "[Width=");
            ruleText = ruleText.replace("/\[height=/gi", "[Height=");
        }

        return ruleText;
    };

    /**
     * Updates rule text
     */
    const overrideRule = function (ruleText, platform) {
        if (platform === 'ext_edge') {
            ruleText = fixCssRuleAttributesForEdge(ruleText);
        }

        return ruleText;
    };

    /**
     * Rewrites title and description
     * https://github.com/AdguardTeam/AdguardFilters/issues/5138#issuecomment-328847738
     */
    const rewriteHeader = function (header) {
        const result = [];
        header.forEach((line) => {
            if (line.startsWith("! Title: ")) {
                line = "! Title: AdGuard English filter";
            } else if (line.startsWith("! Description: ")) {
                line = "! Description: Filter list that specifically removes adverts on English language websites. English filter is supposed to work along with EasyList.";
            }

            result.push(line);
        });

        return result;
    };

    /**
     * Filters easylist block from list of rules
     * https://github.com/AdguardTeam/AdguardFilters/issues/5138#issuecomment-328847738
     */
    const rewriteRules = function (rules) {
        const filtered = [];
        let flag = -1;
        for (let i = 0; i < rules.length; i++) {
            let rule = rules[i];

            if (flag >= 0 && rule.startsWith("!------------------")) {
                if (flag !== i - 1) {
                    // we skip next line after block header
                    // looking for the end of easylist block
                    flag = -1;
                }

                continue;
            }

            if (rule.startsWith("!------------------ EasyList rules")) {
                flag = i;
                continue;
            }

            if (flag < 0) {
                filtered.push(rule);
            }
        }

        return filtered;
    };

    /**
     * Replaces Version: with OriginalVersion: comments in case of some client cannot afford it.
     *
     * @param rules
     */
    const fixVersionComments = function (rules) {
        return rules.map((x) => {
            if (x.startsWith('! Version:')) {
                return x.replace('! Version:', '! OriginalVersion:');
            }

            return x;
        });
    };

    /**
     * Removes `[Adblock Plus x.x]` strings
     *
     * @param inclusionContent
     */
    const removeAdblockVersion = function (inclusionContent) {
        return inclusionContent.replace(/\!?.?\[Adblock.*?\]\r?\n?/g, "");
    };

    /**
     * Corrects metadata for backward compatibility with old clients on MAC platform
     * Hides tag fields
     *
     * @param metadata
     */
    const rewriteMetadataForOldMac = function (metadata) {
        delete metadata.tags;

        if (metadata.filters && metadata.filters.length > 0) {
            for (let f of metadata.filters) {
                if (f.tags) {
                    delete f.tags;
                    delete f.timeAdded;
                }
            }
        }

        return metadata;
    };

    return {
        overrideRule: overrideRule,
        rewriteHeader: rewriteHeader,
        rewriteRules: rewriteRules,
        fixVersionComments: fixVersionComments,
        removeAdblockVersion: removeAdblockVersion,
        rewriteMetadataForOldMac: rewriteMetadataForOldMac
    };
})();