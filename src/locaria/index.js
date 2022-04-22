import Websockets from "./libs/Websockets";
/*
 * Add react
 */
import React from 'react';
import ReactDOM from 'react-dom';
import App from './components/App';
import {theme, configs, resources} from "themeLocaria";
import {ThemeProvider} from '@mui/material/styles';
import CssBaseline from "@mui/material/CssBaseline";


import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';

import cssOL from './components/css/ol.css';
import {setSystemConfig} from "./components/admin/redux/slices/systemConfigDrawerSlice";

let tries = 0;

document.title = configs.siteTitle;
window.websocket = new Websockets();

window.websocket.init({"url": resources.websocket}, connected, closed, errored);

window.websocket.registerQueue('bulkConfigs', (json) => {
    window.systemMain = json.systemMain.packet.systemMain;
    window.systemPages = json.systemPages.packet.systemPages||[];
    ReactDOM.render(<Main/>, document.getElementById('root'));
});

function connected() {
    window.websocket.sendBulk('bulkConfigs', [
        {
            "queue": "systemMain",
            "api": "api",
            "data": {
                "method": "get_parameters",
                "parameter_name": "systemMain",

            }
        },{
            "queue": "systemPages",
            "api": "api",
            "data": {
                "method": "get_parameters",
                "parameter_name": "systemPages",

            }
        }
        ]
    );
}

function closed(event) {
    console.log(`websock closed: ${event}`);
    if (tries <= 3)
        window.websocket.connect();
}

function errored(event) {
    tries++;
    console.log(`websock errored: ${event}`);
    if (tries > 2) {
        ReactDOM.render(<Main/>, document.getElementById('root'));
    }
}

function Main() {
    return (
        <ThemeProvider theme={theme}>
            <CssBaseline/>
            <App/>
        </ThemeProvider>
    )
}



