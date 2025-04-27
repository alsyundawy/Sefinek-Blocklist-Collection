const { Router } = require('express');
const router = Router();

const MainController = require('../controllers');

router.get('/', MainController.index);
router.get('/false-positives', MainController.falsePositives);
router.get('/update-schedule', MainController.updateSchedule);

module.exports = router;