# See LICENSE file for full copyright and licensing details.

{
    'name': 'POS Special Command',
    'version': '12.0.0.1.1',
    'category': 'Point Of Sale',
    'sequence': 6,
    'summary': 'Allow to Special Command for reservation',
    'description': """

This module allows you to Special Command functionality for reservation
    """,
    'author': 'Accomodata',
    'maintainer': 'Accomodata',
    'website': 'https://www.accomodata.be',
    'depends': ['pos_reservation', 'pos_chat'],
    'data': [
        'data/special_command_mail_template_data.xml',
        'views/pos_special_command_views.xml',
        'views/templates.xml',
    ],
    'qweb': ['static/src/xml/pos_special_command.xml'],
    'installable': True,
    'auto_install': False,
    'application': False,
}
