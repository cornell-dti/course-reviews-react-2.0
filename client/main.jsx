import React from 'react';
import { Meteor } from 'meteor/meteor';
import { render } from 'react-dom';

import App      from '../imports/ui/App.jsx';
import Update from '../imports/ui/Update.jsx';

import {BrowserRouter, Route } from "react-router-dom";

Meteor.startup(() => {
    render(
        <BrowserRouter>
            <div>
                <Route name="login" path="/app"  component={ App } />
                <Route name="admin"  path="/admin" component={ Update } />
                <Route name="auth"  path="/auth" component={ Auth} />
            </div>
        </BrowserRouter>,
        document.getElementById('render-target')
    );

  //put back in after testing 
  //<Route name="admin"  path="/L9tmtSl0UIXVq8Bp8gyXYKE8dn6TBa9pIth8rFG1y3DvAKCnSO0gyBYVeeOC0iqd8I0bwKobhkkSiHpkAgZMVcrpFSZPqAaT00mCi3vBfv5IueevzVg6XYwc" component={ Update } />

});
