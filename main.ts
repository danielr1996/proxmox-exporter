import 'dotenv/config'
import {Proxmox, proxmoxApi} from "proxmox-api";
import {ProxmoxEngineOptions} from "proxmox-api/src/ProxmoxEngine";
import express from "express"
import {collectDefaultMetrics, Gauge} from "prom-client";
import {register} from "prom-client";
import clusterResourcesResources = Proxmox.clusterResourcesResources;
const config: ProxmoxEngineOptions = {
    host: process.env.PROXMOX_HOST || '127.0.0.1',
    port: parseInt(process.env.PROXMOX_PORT || '8006'),
    username: process.env.PROXMOX_USERNAME || 'root@pam',
    password: process.env.PROXMOX_PASSWORD || '',
}
const proxmox = proxmoxApi(config);

/**
 * Cluster Metrics
 */
const clusterMetrics = [
    {
        name: 'pve_cluster_quorate',
        help: 'cluster has quorate',
        pve_key: 'quorate',
    },
    {
        name: 'pve_cluster_nodes',
        help: 'number of nodes in the cluster',
        pve_key: 'nodes',
    },
    {
        name: 'pve_cluster_version',
        help: 'corosync config version',
        pve_key: 'version',
    },
]
clusterMetrics.forEach(({name, help,pve_key})=>{
    new Gauge({
        name,
        help,
        labelNames: ['name'],
        async collect(){
            const cluster = (await proxmox.cluster.status.$get()).filter(s=>s.type=== 'cluster')[0]
            this.set({name: cluster.name},cluster[pve_key])
        }
    })
})

/*
Node Metrics
 */
const nodeMetrics = [
    {
        name: 'pve_node_disk_size_bytes',
        help: 'Size of storage device',
        pve_key: 'maxdisk',
    },
    {
        name: 'pve_node_disk_usage_bytes',
        help: 'Disk usage in bytes',
        pve_key: 'disk',
    },
    {
        name: 'pve_node_memory_size_bytes',
        help: 'Size of memory',
        pve_key: 'maxmem',
    },
    {
        name: 'pve_node_memory_usage_bytes',
        help: 'Memory usage in bytes',
        pve_key: 'mem',
    },
    {
        name: 'pve_node_cpu_usage_ratio',
        help: 'CPU usage (value between 0.0 and pve_cpu_usage_limit)',
        pve_key: 'cpu',
    },
    {
        name: 'pve_node_cpu_usage_limit',
        help: 'Maximum allowed CPU usage',
        pve_key: 'maxcpu',
    },
    {
        name: 'pve_node_uptime_seconds',
        help: 'Number of seconds since the last boot',
        pve_key: 'uptime',
    },
]
nodeMetrics.forEach(({name, help,pve_key})=>{
    new Gauge({
        name,
        help,
        labelNames: ['id', 'name','status'],
        async collect(){
            const nodes = await proxmox.nodes.$get()
            nodes.forEach(({id,node,status,[pve_key]: metric})=>this.set({id,name:node,status},metric || 0))
        }
    })
})

/*
VM Metrics
 */
const vmMetrics = [
    {
        name: 'pve_vm_disk_size_bytes',
        help: 'Size of storage device',
        pve_key: 'maxdisk',
    },
    {
        name: 'pve_vm_disk_usage_bytes',
        help: 'Disk usage in bytes',
        pve_key: 'disk',
    },
    {
        name: 'pve_vm_memory_size_bytes',
        help: 'Size of memory',
        pve_key: 'maxmem',
    },
    {
        name: 'pve_vm_memory_usage_bytes',
        help: 'Memory usage in bytes',
        pve_key: 'mem',
    },
    {
        name: 'pve_vm_network_transmit_bytes',
        help: 'Number of bytes transmitted over the network',
        pve_key: 'netout',
    },
    {
        name: 'pve_vm_network_receive_bytes',
        help: 'Number of bytes received over the network',
        pve_key: 'netin',
    },
    {
        name: 'pve_vm_disk_write_bytes',
        help: 'Number of bytes written to storage',
        pve_key: 'diskwrite',
    },
    {
        name: 'pve_vm_disk_read_bytes',
        help: 'Number of bytes read from storage',
        pve_key: 'diskread',
    },
    {
        name: 'pve_vm_cpu_usage_ratio',
        help: 'CPU usage (value between 0.0 and pve_cpu_usage_limit)',
        pve_key: 'cpu',
    },
    {
        name: 'pve_vm_cpu_usage_limit',
        help: 'Maximum allowed CPU usage',
        pve_key: 'maxcpu',
    },
    {
        name: 'pve_vm_uptime_seconds',
        help: 'Number of seconds since the last boot',
        pve_key: 'uptime',
    },
]
vmMetrics.forEach(({name, help,pve_key})=>{
    new Gauge({
        name,
        help,
        labelNames: ['id', 'name', 'vmid','node','status'],
        async collect(){
            const vms = await proxmox.cluster.resources.$get({type: 'vm'})
            vms.forEach(({id,name,vmid,node,status,[pve_key]: metric})=>this.set({id,name,vmid,node,status},metric || 0))
        }
    })
})
/*
Storage
 */
const storageMetrics = [
    {
        name: 'pve_storage_size_bytes',
        help: 'Size of storage device',
        pve_key: 'maxdisk',
    },
    {
        name: 'pve_storage_usage_bytes',
        help: 'Disk usage in bytes',
        pve_key: 'disk',
    },
]
storageMetrics.forEach(({name, help,pve_key})=>{
    new Gauge({
        name,
        help,
        labelNames: ['name', 'node', 'status','id','shared','content'],
        async collect(){
            const kindaUnique = (arr: clusterResourcesResources[])=>{
                const map = new Map()
                arr.forEach(s=>{
                    if(Boolean(s.shared)){
                        map.set(s.storage,s)
                    }else{
                        map.set(s.id, s)
                    }
                })
                return Array.from(map.values())
            }
            const storage = await proxmox.cluster.resources.$get({type: 'storage'})
            kindaUnique(storage).forEach(({id,storage,node,status,shared,content,[pve_key]: metric})=>this.set({id,node,status,name: storage,shared,content},metric || 0))
        }
    })
})

new Gauge({
    name: 'pve_version_info',
    help: 'pve_version_info Proxmox VE version info',
    labelNames: ['version','release','repoid'],
    async collect(){
        const version = await proxmox.version.$get()
        this.set(version, 1)
    }
})

collectDefaultMetrics()

const server = express()
server.get('/metrics', async (req, res) => {
    try {
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
    } catch (ex) {
        res.status(500).end(ex);
    }
});

const port = process.env.PORT || 9876;
console.log(
    `Server listening to ${port}, metrics exposed on /metrics endpoint`,
);
server.listen(port);
