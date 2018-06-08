import { ViewModelApiInterface } from "deus-engine-manager-api";
import { hasMobileViewModel, hasMedicViewModel } from "../helpers/view-model-helper";
import { systemsIndices, BiologicalSystems, biologicalSystemsNames } from "../helpers/magellan";

interface PageViewModel {
  menuTitle: string;
  __type: string;
  viewId: string;
}


interface Row {
    text: string,
    value: string,
    percent?: number,
    valueColor?: string
};

function getCharacterName(model) {
    return model.firstName + " " + model.lastName;
}

function getStartPage(model) {
    const items: Row[] = [
        {
            text: "Имя",
            value: getCharacterName(model),
        },
        {
            text: "ID",
            value: model._id,
        },
        {
            text: "e-mail",
            value: model.mail,
        },

    ];

    let pageInfo = {
        __type: "ListPageViewModel",
        viewId: "page:general",
        menuTitle: "Общая информация",
        body: {
            title: "Общая информация",
            items: items
        },
    };

    if (!model.isAlive) {
        pageInfo.body.items.unshift({
            text: "Состояние персонажа", value: "Вы мертвы!", valueColor: "#ff565c"
        });
    }

    let illnesses = model.modifiers.filter(e => e.class == "illness" && e.currentStage > 2);

    if (illnesses && illnesses.length) {
        pageInfo.body.items.push({
            text: "Внимание!",
            value: "Больно и плохо, врача!",
            valueColor: "#ff565c",
            percent: 100
        });
    }
    else /*if (isHuman)*/ {
        pageInfo.body.items.push({
            text: "Инфо:",
            value: "Проверяй ALICE часто",
        });

    }

    return pageInfo;
}


function getRussianConditionTag(tag) {
    switch (tag) {
        case "physiology": return "Физиология";
        case "mind": return "Психология";
        default: return "Физиология";
    }
}

function getConditionsPageItem(cond) {
    let header = cond.text;
    let details = cond.details ? cond.details : header;
    let condClass = cond.class ? cond.class : "physiology";

    if (details == header || details == (header + ".")) {
        header = "Состояние";
    }

    return {
        viewId: "id:" + cond.id,
        text: cond.text,
        tag: getRussianConditionTag(condClass),
        icon: condClass,
        details: {
            header,
            text: details
        },
    };
}

function getConditionsPage(model) {
    return {
        __type: "ListPageViewModel",
        viewId: "page:conditions",
        menuTitle: "Состояния",
        body: {
            title: "Ваши состояния",
            items: model.conditions.map(getConditionsPageItem),
            filters: ["Физиология", "Психология"],
        },
    };
}

function getTechnicalInfoPage() {
    return {
        __type: "TechnicalInfoPageViewModel",
        viewId: "page:technicalInfo",
        menuTitle: "Техническая инфа"
    };
}

function getEconomyPage() {
    return {
        __type: "EconomyPageViewModel",
        viewId: "page:economy",
        menuTitle: "Экономика"
    };
}

function getBodyPage(model) {
    const items: any[] = [];
    let result = {
        __type: "ListPageViewModel",
        menuTitle: "Доктор Хаус",
        viewId: "page:body",
        body: {
            title: "Доктор Хаус",
            items
        },
    };
    for (const i of systemsIndices()) {
        const system: BiologicalSystems = i;
        result.body.items.push({
            viewId: "mid:" + BiologicalSystems[system],
            text: biologicalSystemsNames.get(system),
            value: model.systems[i].toString()
        });
    }
    return result;
}

function getChangesPageItem(change) {
    return {
        viewId: "mid:" + change.mID,
        text: change.text,
        unixSecondsValue: Math.round(change.timestamp / 1000),
        details: {
            header: "Изменение",
            text: change.text
        }
    };
}

function getChangesPage(model) {
    return {
        __type: "ListPageViewModel",
        viewId: "page:changes",
        menuTitle: "Изменения",
        body: {
            title: "Изменения",
            items: model.changes.reverse().map(getChangesPageItem),
        },
    };
}

function getPages(model) {
    let pages: PageViewModel[] = [];


    pages.push(getStartPage(model));

    pages.push(getConditionsPage(model));
    pages.push(getBodyPage(model));

    pages.push(getEconomyPage());

    pages.push(getChangesPage(model));

    if (model.hasOwnProperty("showTechnicalInfo") && model.showTechnicalInfo) {
        pages.push(getTechnicalInfoPage());
    }

    return pages;
}

function getMenu(model) {
    return {
        characterName: getCharacterName(model),
    };
}

function getPassportScreen(model) {
    return {
        id: model._id,
        fullName: model.firstName + " " + model.lastName,
        corporation: model.corporation ? model.corporation : "",
        email: model.mail ? model.mail : "",
    };
}

function getViewModel(model) {
    return {
        _id: model._id,
        timestamp: model.timestamp,
        menu: getMenu(model),
        passportScreen: getPassportScreen(model),
        pages: getPages(model),
    };
}

module.exports = () => {
    return {
        _view(api: ViewModelApiInterface, model) {
            if (hasMobileViewModel(model)) {
                try {
                    return getViewModel(model);
                }
                catch (err) {
                    // The app would display error message when ViewModel is incorrect
                    console.error(err);
                    return {};
                }
            } else if (hasMedicViewModel(model)) {
                return model
            } else
                return undefined;
        }
    };
};
