$(function () {
    'use strict';
    if (typeof owl !== 'undefined') {
        // @web_tour/tour_service/tour_service appeared in saas-16.3.
        // It was under @web_tour/services/tour_service before that.
        if (!_.has(odoo.__DEBUG__.services, '@web_tour/tour_service/tour_service')) {
            return;
        }
        odoo.define('saas_fullstory.api', [], function (require) {
            return {
                // Starts recording and makes the FullStory Browser API available.
                record: function () {
                    // BEGIN snippet
                    window['_fs_debug'] = false;
                    window['_fs_host'] = 'fullstory.com';
                    window['_fs_script'] = 'edge.fullstory.com/s/fs.js';
                    window['_fs_org'] = 'RRJ53';
                    window['_fs_namespace'] = 'FS';
                    (function (m, n, e, t, l, o, g, y) {
                        if (e in m) { if (m.console && m.console.log) { m.console.log('FullStory namespace conflict. Please set window["_fs_namespace"].'); } return; }
                        g = m[e] = function (a, b, s) { g.q ? g.q.push([a, b, s]) : g._api(a, b, s); }; g.q = [];
                        o = n.createElement(t); o.async = 1; o.crossOrigin = 'anonymous'; o.src = 'https://' + _fs_script;
                        y = n.getElementsByTagName(t)[0]; y.parentNode.insertBefore(o, y);
                        g.identify = function (i, v, s) { g(l, { uid: i }, s); if (v) g(l, v, s) }; g.setUserVars = function (v, s) { g(l, v, s) }; g.event = function (i, v, s) { g('event', { n: i, p: v }, s) };
                        g.shutdown = function () { g("rec", !1) }; g.restart = function () { g("rec", !0) };
                        g.log = function (a, b) { g("log", [a, b]) };
                        g.consent = function (a) { g("consent", !arguments.length || a) };
                        g.identifyAccount = function (i, v) { o = 'account'; v = v || {}; v.acctId = i; g(o, v) };
                        g.clearUserCookie = function () { };
                        g._w = {}; y = 'XMLHttpRequest'; g._w[y] = m[y]; y = 'fetch'; g._w[y] = m[y];
                        if (m[y]) m[y] = function () { return g._w[y].apply(this, arguments) };
                    })(window, document, window['_fs_namespace'], 'script', 'user');
                    // END snippet
                    return true;
                },
                // Stops recording a session (idempotent).
                shutdown: function () {
                    if (typeof FS !== 'undefined') {
                        FS.shutdown();
                    }
                },
                push_event: function (name, props) {
                    if (typeof FS !== 'undefined') {
                        FS.event(name, props);
                    }
                },
            };
        });

        var deps = [
            'saas_fullstory.api',
            'web.session',
            '@web/core/registry'
        ];
        // if backend assets are loaded.
        if (_.has(odoo.__DEBUG__.services, '@web_enterprise/webclient/home_menu/home_menu')) {
            deps.push('@web_enterprise/webclient/home_menu/home_menu');
            deps.push('@web/core/utils/patch');
        }
        odoo.define('saas_fullstory.controller', deps, function (require) {
            var fs = require('saas_fullstory.api');
            var session = require('web.session');

            session.rpc('/saas_worker/trial_info', {}).then(function(trial_info) {
                var d = new Date(trial_info.create_date);
                var d_utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()));
                if ((Date.now() - d_utc.getTime()) / 60000 < 120) {
                    fs.record();
                }
            });

            var storage_key = 'fs_stop_time';

            // Schedule the recording to stop. Times are expressed in ms.
            var stop_time = null;
            if (localStorage.getItem(storage_key) === null) {
                stop_time = Date.now() + 120 * 60 * 1000;
                localStorage.setItem(storage_key, stop_time);
            } else {
                stop_time = new Date(parseInt(localStorage.getItem(storage_key))).getTime();
            }

            // Defer the shutdown call until stop_time is reached.
            setTimeout(function() {
                fs.shutdown();
            }, stop_time - Date.now());

            // if backend assets are loaded.
            if (_.has(odoo.__DEBUG__.services, '@web_enterprise/webclient/home_menu/home_menu')) {
                var { HomeMenu } = require('@web_enterprise/webclient/home_menu/home_menu');  // app switcher
                const { patch } = require('@web/core/utils/patch');
                patch(HomeMenu.prototype, 'saas_fullstory/static/js/fullstory.js', {
                    _openMenu(menu) {
                        // Push navigation event.
                        this._super(...arguments);
                        fs.push_event('Menu opened', {
                            xmlid: menu.xmlid,
                        });
                    }
                });
            }

            const { registry } = require('@web/core/registry');
            const fullstoryService = {
                dependencies: ['tour_service'],
                start: (env, { tour_service }) => {
                    // Push an event each time a tour step is completed.
                    tour_service.bus.addEventListener('STEP-CONSUMMED', ({ detail }) => {
                        fs.push_event('Tour step completed', {
                            tour: detail.tour.name,
                            step: detail.step.trigger,
                        });
                    });
                },
            };
            registry.category('services').add('fullstory_service', fullstoryService);
        });
    }
});
