const { merge } = require('lodash');

const startXazabCore = require('@xazabevo/dp-services-ctl/lib/services/xazabCore/startXazabCore');
const startInsightUi = require('./service-ctl/startInsightUI');

async function remove(services) {
  const insightDeps = [
    services.xazabCore,
  ];
  await Promise.all(insightDeps.map(instance => instance.remove()));
}

/**
 * @typedef InsightUI
 * @property {DapiCore} insightUi
 * @property {XazabCore} xazabCore
 * @property {Promise<void>} clean
 * @property {Promise<void>} remove
 */

/**
 * Create Insight UI instance
 *
 * @param {object} [options]
 * @returns {Promise<InsightUI>}
 */
async function startInsightUI(options) {
  const instances = await startInsightUi.many(1, options);
  return instances[0];
}

/**
 * Create Insight UI instances
 *
 * @param {Number} number
 * @param {object} [options]
 * @returns {Promise<InsightUI[]>}
 */
startInsightUI.many = async function many(number, options = {}) {
  if (number < 1) {
    throw new Error('Invalid number of instances');
  }
  if (number > 1) {
    throw new Error("We don't support more than 1 instance");
  }


  const xazabCoreInstancesPromise = startXazabCore.many(number, options.xazabCore);
  const [xazabCoreInstances] = await Promise.all([
    xazabCoreInstancesPromise,
  ]);

  const instances = [];

  for (let i = 0; i < number; i++) {
    const xazabCore = xazabCoreInstances[i];


    const insightUIOptions = {
      container: {},
      config: {},
      ...options.insightUI,
    };

    merge(insightUIOptions.config, {
      servicesConfig: {
        xazabd: {
          connect: [{
            rpchost: `${xazabCore.getIp()}`,
            rpcport: `${xazabCore.options.getRpcPort()}`,
            rpcuser: `${xazabCore.options.getRpcUser()}`,
            rpcpassword: `${xazabCore.options.getRpcPassword()}`,
            zmqpubrawtx: `tcp://host.docker.internal:${xazabCore.options.getZmqPorts().rawtx}`,
            zmqpubhashblock: `tcp://host.docker.internal:${xazabCore.options.getZmqPorts().hashblock}`,
          }],
        },
      },
    });


    const insightUIPromise = await startInsightUI(insightUIOptions);

    const [insightUi] = await Promise.all([
      insightUIPromise,
    ]);


    const instance = {
      insightUi,
      xazabCore,
      async clean() {
        await remove(instance);

        const newServices = await startInsightUI(options);

        Object.assign(instance, newServices);
      },
      async remove() {
        await remove(instance);
      },
    };

    instances.push(instance);
  }

  return instances;
};

module.exports = startInsightUI;
