const Telegraf = require('telegraf');
const bot = new Telegraf('740806320:AAHed7FF4YbRKkzfALGxLUTtP4nFFm2DA0E');
const cron=require('cron');
const cronJob = cron.CronJob;
const axios = require('axios');
const session = require("telegraf/session");
const Stage = require("telegraf/stage");
const Scene = require('telegraf/scenes/base');
const { enter, leave } = Stage;
const Extra = require('telegraf/extra');
const Markup = require('telegraf/markup');
const messages = require('./messages');
let job = null,
    city = "Киев",
    lang = 'ru';


function send(days, type) {
    function getDateString(day){
        const date = new Date();
        if(day < date.getDate()){
            return `${date.getFullYear()}-${date.getMonth()+1<10?'0'+(+date.getMonth()+2):(+date.getMonth+2)}-${day<10?'0'+day:day}`
        }else{
            return `${date.getFullYear()}-${date.getMonth()<10?'0'+(+date.getMonth()+1):(+date.getMonth()+1)}-${day<10?'0'+day:day}`
        }
    }
    let params={
            city:city
    };
    type===true?params.days=days:params.date=getDateString(days);
    try{
        return axios.get('http://opogode.ua/api/v1/forecasts.json',{
            params:params
        })
    }catch (e){
        console.error(e);
    }
};


async function formForecast(arr,ctx) {
    for (let el of arr) {
        let str = `${el.date}: \n`;
                for(let t of ['night','morning','afternoon','evening']) {
                    str+=`     ${messages.daytime[t][lang]}\n${messages.cond[lang]}${(el[t].condition === null ? messages.unav[lang] : el[t].condition['name_'+lang])}\n${messages.temp[lang]} ${el[t].temperature}\n${messages.hum[lang]} ${el[t].humidity}\n${messages.pres[lang]} ${el[t].pressure}\n`
                }
        await ctx.reply(str);
    }
}


bot.start(async ctx => {
  await ctx.reply(messages.start,
      Markup
      .keyboard(['Дата',"Кол-во"])
      .resize()
      .extra()
  );
});


const setCity = new Scene("setCity");

setCity.enter(ctx=>ctx.reply(messages.city.enter[lang]));

setCity.on('text',(ctx)=>{
            city= ctx.message.text.trim();
            send(1,true)
                .then(()=>ctx.reply(messages.city.main[lang]))
                .catch(e=>{
                    ctx.reply(messages.city.err[lang]);
                })
});


const setTime = new Scene("setTime");

setTime.enter(ctx=>ctx.reply(messages.time.main[lang]));

setTime.on("text",(ctx)=>{
    const hours = parseInt(ctx.message.text.trim(),10);
    if(hours>23||hours<0||isNaN(hours)){
        return ctx.reply(messages.invalid[lang]);
    }else{
        ctx.reply(`${messages.time.leave[lang]} ${hours}:00`);
        if(job==null) {
            job = new cronJob('0 0 ' + hours + ' * * *', function () {
                const data = send(1,true)
                    .then(async res => {
                        if (res.data) {
                            formForecast(res.data.forecasts,ctx);
                        }else {
                            ctx.reply(messages.err[lang])
                        }
                    }).catch(e=>ctx.reply(messages.err[lang]))
            });
            job.start();
        }else{
            job.setTime(new cron.CronTime( '0 0 ' + hours + ' * * *'));
        }
    }
});

const getByDate = new Scene("getByDate");
getByDate.enter(ctx=>ctx.reply(messages.date[lang]));
getByDate.on("text", ctx => {
    let req = parseInt(ctx.message.text.trim(),10);
    if(req>31 ||req<1||isNaN(req)){
        return ctx.reply(messages.invalid[lang])
    }
    const data = send(req,false)
        .then(async res=>{
            if (res.data) {
                if(res.data.forecasts.length===0) return ctx.reply(messages.dateunav[lang]);
                formForecast(res.data.forecasts,ctx);
            }else{
                await ctx.reply(messages.err[lang]);
            }
        }).catch(e=>ctx.reply(messages.err[lang]))
});


const getByAmount = new Scene("getByAmount");

getByAmount.enter(ctx=>ctx.reply(messages.am[lang]));

getByAmount.on("text", ctx => {
    let req = parseInt(ctx.message.text.trim(),10);
    if(req>5 ||req<1||isNaN(req)){
        return ctx.reply(messages.invalid[lang]);
    }
    const data = send(req,true)
        .then(async res=>{
            if (res.data) {
                formForecast(res.data.forecasts,ctx);
            }else{
                await ctx.reply(messages.err[lang]);
            }
        }).catch(e=>ctx.reply(messages.err[lang]))
});


bot.command('stopTimer',ctx => {
    if(job!==null){
        job.stop();
        job = null;
    }
    ctx.reply(messages.stop[lang]);
});


bot.command('help',
    ctx => {
        ctx.reply(messages.help[lang]);
    });


bot.command('ru',ctx => {
    lang = 'ru';
    return ctx.reply('Язык изменен на русский. Используйте /help для получения информации о командах на выбранном языке',
        Markup
            .keyboard(['Дата',"Кол-во"])
            .resize()
            .extra())
});


bot.command('ua',ctx => {
    lang = 'ua';
    return ctx.reply('Мову змінено на українську. Застосуйте /help для отримання інформації про команди на обраній мові',
        Markup
            .keyboard(['Дата',"Кільк."])
            .resize()
            .extra())
});


bot.command('en',ctx => {
    lang = 'en';
    return ctx.reply('Language changed to english. Use /help to get info about commands in chosen language',
        Markup
        .keyboard(['Date',"Amount"])
        .resize()
        .extra())
});


const stage = new Stage([setCity,setTime,getByDate,getByAmount],{ ttl: 10 });
bot.use(session());
bot.use(stage.middleware());


bot.command("setCity",enter("setCity"));
bot.command("setTime",enter("setTime"));
bot.hears("Дата",enter("getByDate"));
bot.hears("Кол-во",enter("getByAmount"));
bot.hears("Date",enter("getByDate"));
bot.hears("Amount",enter("getByAmount"));
bot.hears("Кільк.",enter("getByAmount"));

bot.launch();
