//REQUERINDO MODULOS
const moment = require("moment-timezone")
moment.tz.setDefault('America/Sao_Paulo')
require('dotenv').config()
const { create, Client } = require('@open-wa/wa-automate')
const {criarArquivosNecessarios, criarTexto, consoleErro, corTexto} = require('./lib/util')
const {verificacaoListaNegraGeral} = require(`./lib/listaNegra`)
const {atualizarParticipantes} = require("./lib/controleParticipantes")
const config = require('./config')
const msgTratamento = require('./msgTratamento')
const msgs_texto = require("./lib/msgs")
const recarregarContagem = require("./lib/recarregarContagem")
const {botStart} = require('./lib/bot')
const {verificarEnv} = require('./lib/env')

const start = async (client = new Client()) => {
    try{
        //VERIFICA SE É NECESSÁRIO CRIAR ALGUM TIPO DE ARQUIVO NECESSÁRIO
        let necessitaCriar = await criarArquivosNecessarios()
        if(necessitaCriar){
            console.log(corTexto(msgs_texto.inicio.arquivos_criados))
            setTimeout(()=>{
                return client.kill()
            },10000)
        } else {
            const eventosGrupo = require('./lib/eventosGrupo')
            const antiLink = require('./lib/antiLink')
            const antiFlood = require('./lib/antiFlood')
            const cadastrarGrupo = require('./lib/cadastrarGrupo')

            //Pegando hora de inicialização do BOT
            console.log(corTexto(await botStart()))
            //Cadastro de grupos
            console.log(corTexto(await cadastrarGrupo("","inicio",client)))
            //Verificar lista negra dos grupos
            console.log(corTexto(await verificacaoListaNegraGeral(client)))
            //Atualização dos participantes dos grupos
            console.log(corTexto(await atualizarParticipantes(client)))
            //Atualização da contagem de mensagens
            console.log(corTexto(await recarregarContagem(client)))
            //Verificando se os campos do .env foram modificados e envia para o console
            verificarEnv()

            //INICIO DO SERVIDOR
            console.log('[SERVIDOR] Servidor iniciado!')

            // Forçando para continuar na sessão atual
            client.onStateChanged((estado) => {
                console.log('[ESTADO CLIENTE]', estado)
                if (estado === 'CONFLICT' || estado === 'UNLAUNCHED') client.forceRefocus()
            })

            // Ouvindo mensagens
            client.onMessage((async (message) => {
                var msgs = await client.getAmountOfLoadedMessages()
                if(msgs >= 3000) await client.cutMsgCache()
                await antiLink(client,message)
                await antiFlood(client,message)
                await msgTratamento(client, message)
            }))

            //Ouvindo entrada/saida de participantes dos grupo
            client.onGlobalParticipantsChanged((async (ev) => {
                await eventosGrupo(client, ev)
            }))
            
            //Ouvindo se a entrada do BOT em grupos
            client.onAddedToGroup((async (chat) => {
                await cadastrarGrupo(chat.id, "added", client)
                let gInfo = await client.getGroupInfo(chat.id)
                await client.sendText(chat.id, criarTexto(msgs_texto.geral.entrada_grupo, gInfo.title))
            }))

            // Ouvindo ligações recebidas
            client.onIncomingCall(( async (call) => {
                await client.sendText(call.peerJid, msgs_texto.geral.sem_ligacoes).then(async ()=>{
                    client.contactBlock(call.peerJid)
                })
            }))

        } 
    } catch(err) {
        //Faça algo se der erro em alguma das funções acima
        console.error(corTexto("[ERRO FATAL]","#d63e3e"), err.message)
        setTimeout(()=>{
            return client.kill()
        },10000)
    }
}

create(config(true, start))
    .then(client => start(client))
    .catch((error) => consoleErro(error, 'OPEN-WA'))
